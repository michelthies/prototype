import { check } from 'k6';
import exec from 'k6/execution';
import { baseUrl, pattern, region, postEvent, logTracking } from './common.js';

const vus = 20;
const duration = 5;

export const options = {
    scenarios: {
        warmup: {
            executor: 'constant-vus',
            vus: vus,
            duration: '2s',
            tags: { phase: 'warmup' },
        },
        throughput: {
            executor: 'constant-vus',
            vus: vus,
            duration: `${duration}s`,
            startTime: '2s',
            tags: { phase: 'measurement' },
        },
    },
    thresholds: {
        'http_req_failed{phase:measurement}': ['rate<0.05'],
        'http_req_waiting{phase:measurement}': ['p(99)>=0'],
        'http_reqs{phase:measurement}': ['count>=0'],
        'dropped_iterations': ['count>=0'],
        'http_req_waiting{phase:warmup}': ['p(99)>=0'],
        'http_req_failed{phase:warmup}': ['rate>=0'],
    },
    summaryTrendStats: ['min', 'p(50)', 'p(95)', 'p(99)', 'max', 'count'],
};

export default function () {
    const isWarmup = exec.scenario.name === 'warmup';
    
    const res = postEvent();

    if (!isWarmup) {
        check(res, { 'status 200': (r) => r.status === 200 });
        logTracking(res);
    }
}

export function handleSummary(data) {
    const m = data.metrics;
    const measurement = (name, stat) => m[`${name}{phase:measurement}`]?.values?.[stat] ?? null;
    const warmup = (name, stat) => m[`${name}{phase:warmup}`]?.values?.[stat] ?? null;

    const cleanMetrics = {
        test: 'throughput',
        pattern: pattern,
        region: region,
        workerUrl: baseUrl,
        vus: vus,
        duration: `${duration}s`,
        dropped: measurement('dropped_iterations', 'count') ?? 0,
        measurement: {
            req_per_sec: measurement('http_reqs', 'count') / duration,
            total_requests: measurement('http_reqs', 'count'),
            success_rate: 1 - (measurement('http_req_failed', 'rate') ?? 0),
            ttfb_ms: {
                p50: measurement('http_req_waiting', 'p(50)'),
                p95: measurement('http_req_waiting', 'p(95)'),
                p99: measurement('http_req_waiting', 'p(99)'),
            },
        },
        warmup: {
            success_rate: 1 - (warmup('http_req_failed', 'rate') ?? 0),
            ttfb_ms: {
                min: warmup('http_req_waiting', 'min'),
                p50: warmup('http_req_waiting', 'p(50)'),
                p99: warmup('http_req_waiting', 'p(99)'),
                max: warmup('http_req_waiting', 'max'),
                count: warmup('http_req_waiting', 'count'),
            },
        },
    };

    return {
        stdout: JSON.stringify(cleanMetrics) + '\n',
        [__ENV.SUMMARY_FILE]: JSON.stringify(cleanMetrics, null, 2),
    };
}