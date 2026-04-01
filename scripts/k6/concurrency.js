import { check } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';
import { baseUrl, pattern, region, postEvent, logTracking } from './common.js';

const levels = 40;
const stepS = 3;

const errorCount = new Counter('request_errors');

function buildScenarios() {
    const scenarios = {};
    for (let i = 0; i < levels; i++) {
        const level = i + 1;
        scenarios[`vus_${level}`] = {
            executor: 'per-vu-iterations',
            vus: level,
            iterations: 1,
            maxDuration: '8s',
            startTime: `${i * stepS}s`,
            tags: { phase: 'measurement', concurrency_level: String(level) },
        };
    }
    return scenarios;
}

function buildThresholds() {
    const thresholds = {
        'http_req_failed{phase:measurement}': ['rate<0.05'],
    };
    for (let level = 1; level <= levels; level++) {
        thresholds[`http_req_failed{concurrency_level:${level}}`] = ['rate>=0'];
        thresholds[`request_errors{concurrency_level:${level}}`] = ['count>=0'];
    }
    return thresholds;
}

export const options = {
    scenarios: buildScenarios(),
    thresholds: buildThresholds(),

};

export default function () {
    const level = exec.scenario.name.replace('vus_', '');
    const tags = { concurrency_level: level };

    const res = postEvent(tags);
    const ok = check(res, { 'status 200': (r) => r.status === 200 });
    if (!ok) errorCount.add(1, tags);

    logTracking(res, `level:${level} `);
}

export function handleSummary(data) {
    const m = data.metrics;

    function metric(name, level, stat) {
        return m[`${name}{concurrency_level:${level}}`]?.values?.[stat] ?? null;
    }

    const stages = [];
    for (let level = 1; level <= levels; level++) {
        stages.push({
            concurrency: level,
            success_rate: 1 - (metric('http_req_failed', level, 'rate') ?? 0),
            errors: metric('request_errors', level, 'count') ?? 0,
        });
    }

    let vu_sat = null;
    for (let i = 0; i < stages.length; i++) {
        if (stages[i].success_rate < 0.99) {
            vu_sat = stages[i].concurrency;
            break;
        }
    }

    const cleanMetrics = {
        test: 'concurrency',
        pattern: pattern,
        region: region,
        workerUrl: baseUrl,
        saturation_threshold: 0.99,
        vu_sat,
        stages,
    };

    return {
        stdout: JSON.stringify(cleanMetrics) + '\n',
        [__ENV.SUMMARY_FILE]: JSON.stringify(cleanMetrics, null, 2),
    };
}