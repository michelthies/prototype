import http from 'k6/http';
import { payload10k, payload as payload1k } from './payloads.js'

export const baseUrl = __ENV.BASE_URL;
export const pattern = __ENV.PATTERN;
export const region = __ENV.REGION;
export const agency = __ENV.AGENCY;
export const timeout = '60s';
export const payload = __ENV.PAYLOAD_SIZE === '10kb' ? payload10k : payload1k;

export const authTokens = JSON.parse(__ENV.AUTH_TOKENS);

export function getRandomAuth() {
    const idx = Math.floor(Math.random() * authTokens.length);
    const { token, agency } = authTokens[idx];
    return { cookie: `authToken=${token}`, agency };
}

export function postEvent(tags = {}) {
    const { cookie, agency } = getRandomAuth();
    return http.post(
        `${baseUrl}/${agency}/api/authenticated/events`,
        payload,
        {
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            timeout: timeout,
            tags
        }
    );
}

export function getHeader(headers, targetKey) {
    const target = targetKey.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === target && value) {
            const v = String(value);
            if (target === 'cf-placement' && v.startsWith('remote-')) return v.slice('remote-'.length);
            return v;
        }
    }
    return 'unknown';
}

export function logTracking(res, prefix = '') {
    const colo = getHeader(res.headers, 'x-cf-colo');
    const placementColo = getHeader(res.headers, 'cf-placement');
    const isolateId = getHeader(res.headers, 'x-isolate-id');

    if (colo !== 'unknown') console.log(`[COLO_TRACKER] ${prefix}colo:${colo}`);
    if (placementColo !== 'unknown') console.log(`[PLACEMENT_TRACKER] ${prefix}colo:${placementColo}`);
    if (isolateId !== 'unknown') console.log(`[ISOLATE_TRACKER] ${prefix}id:${isolateId}`);
}