import { check } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';
import { baseUrl, pattern, region, postEvent, logTracking } from './common.js';

const rounds = 20;
const stepS = 3;
const vuSat = pattern === 'pg-pool' ? 4 : 30;

const errorCount = new Counter('request_errors');

function buildScenarios() {
    const scenarios = {};
    for (let i = 0; i < rounds; i++) {
        const round = i + 1;
        scenarios[`round_${round}`] = {
            executor: 'per-vu-iterations',
            vus: vuSat,
            iterations: 1,
            maxDuration: '8s',
            startTime: `${i * stepS}s`,
            tags: { round: String(round) },
        };
    }
    return scenarios;
}

function buildThresholds() {
    const thresholds = {};
    for (let round = 1; round <= rounds; round++) {
        thresholds[`http_req_failed{round:${round}}`] = ['rate>=0'];
        thresholds[`request_errors{round:${round}}`] = ['count>=0'];
    }
    return thresholds;
}

export const options = {
    scenarios: buildScenarios(),
    thresholds: buildThresholds()
};

export default function () {
    const round = exec.scenario.name.replace('round_', '');
    const tags = { round };

    const res = postEvent(tags);

    const ok = check(res, { 'status 200': (r) => r.status === 200 });
    if (!ok) errorCount.add(1, tags);

    logTracking(res, `level:${round} `);
}

export function handleSummary(data) {
    const m = data.metrics;

    function metric(name, round, stat) {
        return m[`${name}{round:${round}}`]?.values?.[stat] ?? null;
    }

    const rounds = [];
    for (let round = 1; round <= rounds; round++) {
        rounds.push({
            round,
            vus: vuSat,
            success_rate: 1 - (metric('http_req_failed', round, 'rate') ?? 0),
            errors: metric('request_errors', round, 'count') ?? 0,
        });
    }

    const cleanMetrics = {
        test: 'burst',
        pattern: pattern,
        region: region,
        workerUrl: baseUrl,
        vus: vuSat,
        rounds,
    };

    return {
        stdout: JSON.stringify(cleanMetrics) + '\n',
        [__ENV.SUMMARY_FILE]: JSON.stringify(cleanMetrics, null, 2),
    };
}