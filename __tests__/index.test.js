'use strict';

const E164 = require('../index');
const Response = require('../lib/response');

/** A representative record, with the numeric types the live API actually returns. */
const GBR_RECORD = {
    prefix: '44113391',
    calling_code: 44,
    iso3: 'GBR',
    tadig: null,
    mccmnc: null,
    type: 'GEOGRAPHIC',
    location: null,
    operator_brand: 'BT',
    operator_company: 'BT',
    total_length_min: 12,
    total_length_max: 12,
    weight: 11,
    source: 'e164',
};

/**
 * Builds a `fetch` stub that answers with the given status, body and headers.
 *
 * @param {{status?: number, body?: any, headers?: Record<string, string>}} [options]
 * @returns {jest.Mock} A mock standing in for `globalThis.fetch`.
 */
function mockFetch({ status = 200, body = [], headers = {} } = {}) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return jest.fn().mockResolvedValue({
        status,
        headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
        text: async () => text,
    });
}

/** Returns the URL string the fetch stub was called with. */
function urlOf(fetchMock) {
    return fetchMock.mock.calls[0][0];
}

describe('E164 SDK', () => {
    describe('URL construction', () => {
        // Regression test for the v1 bug that broke every E.164-formatted number:
        // encodeURIComponent('+441…') produced '%2B441…', which the API answers
        // with a 301 to the marketing site rather than JSON.
        it.each([
            ['+441133910781', 'https://e164.com/441133910781'],
            ['441133910781', 'https://e164.com/441133910781'],
            ['+44 113 391 0781', 'https://e164.com/441133910781'],
            ['+44-113-391-0781', 'https://e164.com/441133910781'],
            ['+1 (212) 456-7890', 'https://e164.com/12124567890'],
            ['+49.151.12345678', 'https://e164.com/4915112345678'],
            [441133910781, 'https://e164.com/441133910781'],
        ])('requests a digits-only path for %p', async (input, expectedUrl) => {
            const fetchMock = mockFetch({ body: [GBR_RECORD] });
            const e164 = new E164({ fetch: fetchMock });

            const result = await e164.lookup(input);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(urlOf(fetchMock)).toBe(expectedUrl);
            expect(urlOf(fetchMock)).not.toContain('%2B');
            expect(result.isSuccess()).toBe(true);
        });

        it('never follows redirects, so an HTML page cannot be mistaken for data', async () => {
            const fetchMock = mockFetch({ body: [GBR_RECORD] });
            await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'manual' });
        });

        it('honours a custom baseUrl and strips its trailing slashes', async () => {
            const fetchMock = mockFetch({ body: [GBR_RECORD] });
            const e164 = new E164({ baseUrl: 'https://proxy.example.com//', fetch: fetchMock });

            await e164.lookup('+441133910781');

            expect(urlOf(fetchMock)).toBe('https://proxy.example.com/441133910781');
        });

        it('sends the documented headers, including caller overrides', async () => {
            const fetchMock = mockFetch({ body: [GBR_RECORD] });
            const e164 = new E164({ fetch: fetchMock, headers: { 'X-Trace-Id': 'abc' } });

            await e164.lookup('+441133910781');

            const { headers } = fetchMock.mock.calls[0][1];
            expect(headers.Accept).toBe('application/json');
            expect(headers.Referer).toBe('https://www.e164.com/');
            expect(headers['User-Agent']).toMatch(/^e164-node\/\d+\.\d+\.\d+$/);
            expect(headers['X-Trace-Id']).toBe('abc');
        });
    });

    describe('successful lookups', () => {
        it('exposes every record field, preserving the API JSON types', async () => {
            const fetchMock = mockFetch({ body: [GBR_RECORD] });
            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(result).toBeInstanceOf(Response);
            expect(result.isSuccess()).toBe(true);
            expect(result.statusCode).toBe(200);
            expect(result.error).toBeNull();

            expect(result.prefix).toBe('44113391');
            expect(result.iso3).toBe('GBR');
            expect(result.type).toBe('GEOGRAPHIC');
            expect(result.operator_brand).toBe('BT');
            expect(result.operator_company).toBe('BT');
            expect(result.source).toBe('e164');
            expect(result.tadig).toBeNull();
            expect(result.mccmnc).toBeNull();
            expect(result.location).toBeNull();

            // Numbers must stay numbers, not be stringified or nulled.
            expect(result.calling_code).toBe(44);
            expect(result.total_length_min).toBe(12);
            expect(result.total_length_max).toBe(12);
            expect(result.weight).toBe(11);

            expect(result.data).toEqual(GBR_RECORD);
        });

        it('takes the most specific match as data and keeps all records in results', async () => {
            const second = { ...GBR_RECORD, prefix: '44113', weight: 5 };
            const fetchMock = mockFetch({ body: [GBR_RECORD, second] });

            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(result.prefix).toBe('44113391');
            expect(result.data).toEqual(GBR_RECORD);
            expect(result.results).toEqual([GBR_RECORD, second]);
        });

        it('accepts a bare object, in case the API stops wrapping records in an array', async () => {
            const fetchMock = mockFetch({ body: GBR_RECORD });
            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(result.isSuccess()).toBe(true);
            expect(result.prefix).toBe('44113391');
            expect(result.results).toEqual([GBR_RECORD]);
        });

        it('preserves falsy field values instead of turning them into null', async () => {
            const fetchMock = mockFetch({ body: [{ ...GBR_RECORD, weight: 0, location: '' }] });
            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(result.weight).toBe(0);
            expect(result.location).toBe('');
        });
    });

    describe('unsuccessful lookups', () => {
        // The live API answers unknown numbers with `200 []`, not a 404.
        it('reports an empty result set as a 404', async () => {
            const fetchMock = mockFetch({ status: 200, body: [] });
            const result = await new E164({ fetch: fetchMock }).lookup('+447700900123');

            expect(result.isSuccess()).toBe(false);
            expect(result.statusCode).toBe(404);
            expect(result.error).toBe('No records found for "+447700900123".');
            expect(result.data).toBeNull();
            expect(result.results).toEqual([]);
        });

        it('surfaces the API error message on a non-2xx status', async () => {
            const fetchMock = mockFetch({ status: 429, body: { error: 'Too many requests' } });
            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(result.statusCode).toBe(429);
            expect(result.error).toBe('Too many requests');
            expect(result.data).toBeNull();
        });

        it('falls back to a status-based message when the body carries no error', async () => {
            const fetchMock = mockFetch({ status: 503, body: '' });
            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(result.statusCode).toBe(503);
            expect(result.error).toBe('Request failed with status code 503.');
        });

        it('reports a redirect as such rather than parsing the page it points at', async () => {
            const fetchMock = mockFetch({
                status: 301,
                body: '<html><head><title>301 Moved Permanently</title></head></html>',
                headers: { location: 'https://www.e164.com' },
            });
            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(result.isSuccess()).toBe(false);
            expect(result.statusCode).toBe(502);
            expect(result.error).toMatch(/Unexpected redirect \(HTTP 301\)/);
        });

        it('reports unparseable JSON without leaking the raw body into the message', async () => {
            const fetchMock = mockFetch({ status: 200, body: '<html>not json</html>' });
            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(result.statusCode).toBe(502);
            expect(result.error).toMatch(/^Could not parse the API response as JSON: /);
            expect(result.data).toBeNull();
        });

        it('reports a JSON scalar body as an unexpected format', async () => {
            const fetchMock = mockFetch({ status: 200, body: '"just a string"' });
            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(result.statusCode).toBe(502);
            expect(result.error).toBe('Received an unexpected data format from the API.');
        });

        it('wraps a network failure in a Response instead of throwing', async () => {
            const fetchMock = jest.fn().mockRejectedValue(
                Object.assign(new TypeError('fetch failed'), {
                    cause: new Error('getaddrinfo ENOTFOUND e164.com'),
                })
            );
            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781');

            expect(result).toBeInstanceOf(Response);
            expect(result.isSuccess()).toBe(false);
            expect(result.statusCode).toBe(500);
            expect(result.error).toBe('fetch failed (getaddrinfo ENOTFOUND e164.com)');
            expect(result.rawResponse).toBeNull();
        });
    });

    describe('input validation', () => {
        it('rejects input with no digits before making a request', async () => {
            const fetchMock = mockFetch();
            const result = await new E164({ fetch: fetchMock }).lookup('invalid-number');

            expect(fetchMock).not.toHaveBeenCalled();
            expect(result.statusCode).toBe(400);
            expect(result.error).toMatch(/no digits found/);
        });

        it.each([
            ['', /no digits found/],
            ['   ', /no digits found/],
            [null, /no digits found/],
            [undefined, /no digits found/],
            [{}, /no digits found/],
            ['0044113391078', /never start with 0/],
            ['1234567890123456', /at most 15 digits/],
        ])('rejects %p without calling the API', async (input, expectedError) => {
            const fetchMock = mockFetch();
            const result = await new E164({ fetch: fetchMock }).lookup(input);

            expect(fetchMock).not.toHaveBeenCalled();
            expect(result.isSuccess()).toBe(false);
            expect(result.statusCode).toBe(400);
            expect(result.error).toMatch(expectedError);
        });

        it('rejects a number too large to hold digits faithfully', async () => {
            const fetchMock = mockFetch();
            const result = await new E164({ fetch: fetchMock }).lookup(1e21);

            expect(fetchMock).not.toHaveBeenCalled();
            expect(result.statusCode).toBe(400);
        });

        it('accepts the full 15-digit E.164 length', async () => {
            const fetchMock = mockFetch({ body: [GBR_RECORD] });
            await new E164({ fetch: fetchMock }).lookup('123456789012345');

            expect(urlOf(fetchMock)).toBe('https://e164.com/123456789012345');
        });
    });

    describe('timeouts and cancellation', () => {
        it('aborts the request and reports 504 once the timeout elapses', async () => {
            const fetchMock = jest.fn((url, { signal }) => new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
                });
            }));

            const result = await new E164({ fetch: fetchMock, timeout: 10 }).lookup('+441133910781');

            expect(result.isSuccess()).toBe(false);
            expect(result.statusCode).toBe(504);
            expect(result.error).toBe('Request timed out after 10ms.');
        });

        it('lets a per-call timeout override the instance default', async () => {
            const fetchMock = jest.fn((url, { signal }) => new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                });
            }));

            const result = await new E164({ fetch: fetchMock, timeout: 60000 })
                .lookup('+441133910781', { timeout: 10 });

            expect(result.statusCode).toBe(504);
            expect(result.error).toBe('Request timed out after 10ms.');
        });

        it('reports caller-initiated cancellation distinctly from a timeout', async () => {
            const controller = new AbortController();
            const fetchMock = jest.fn((url, { signal }) => new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                });
            }));

            const pending = new E164({ fetch: fetchMock, timeout: 0 })
                .lookup('+441133910781', { signal: controller.signal });
            controller.abort();
            const result = await pending;

            expect(result.statusCode).toBe(499);
            expect(result.error).toBe('Request was cancelled.');
        });

        // Headers can arrive promptly while the body stalls forever, so the
        // timeout has to cover the body read too.
        it('times out a response whose body never finishes streaming', async () => {
            const fetchMock = jest.fn(async (url, { signal }) => ({
                status: 200,
                headers: { get: () => null },
                text: () => new Promise((resolve, reject) => {
                    signal.addEventListener('abort', () => {
                        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                    });
                }),
            }));

            const result = await new E164({ fetch: fetchMock, timeout: 10 }).lookup('+441133910781');

            expect(result.statusCode).toBe(504);
            expect(result.error).toBe('Request timed out after 10ms.');
        });

        // `AbortSignal.timeout()` is the pattern the README documents for a
        // per-request deadline, so it must report 504 rather than 499 — aborting
        // the SDK's own controller would otherwise discard the signal's reason.
        it('reports an AbortSignal.timeout() deadline as a timeout, not a cancellation', async () => {
            const fetchMock = jest.fn((url, { signal }) => new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
                });
            }));

            const result = await new E164({ fetch: fetchMock, timeout: 0 })
                .lookup('+441133910781', { signal: AbortSignal.timeout(10) });

            expect(result.isSuccess()).toBe(false);
            expect(result.statusCode).toBe(504);
        });

        it('still reports a custom abort reason as a cancellation', async () => {
            const controller = new AbortController();
            const fetchMock = jest.fn((url, { signal }) => new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                });
            }));

            const pending = new E164({ fetch: fetchMock, timeout: 0 })
                .lookup('+441133910781', { signal: controller.signal });
            controller.abort('user navigated away');
            const result = await pending;

            expect(result.statusCode).toBe(499);
            expect(result.error).toBe('Request was cancelled.');
        });

        it('reports cancellation raised by an axios-style client', async () => {
            const client = {
                get: jest.fn().mockRejectedValue(
                    Object.assign(new Error('canceled'), { name: 'CanceledError', code: 'ERR_CANCELED' })
                ),
            };
            const result = await new E164({ client }).lookup('+441133910781');

            expect(result.statusCode).toBe(499);
            expect(result.error).toBe('Request was cancelled.');
        });

        it('tolerates a null options argument', async () => {
            const fetchMock = mockFetch({ body: [GBR_RECORD] });
            const result = await new E164({ fetch: fetchMock }).lookup('+441133910781', null);

            expect(result.isSuccess()).toBe(true);
        });

        it('does not leave an abort listener on a caller signal after completing', async () => {
            const controller = new AbortController();
            const fetchMock = mockFetch({ body: [GBR_RECORD] });

            await new E164({ fetch: fetchMock }).lookup('+441133910781', { signal: controller.signal });

            // If the listener leaked, aborting a reused signal would still fire it.
            expect(() => controller.abort()).not.toThrow();
        });

        it('does not arm a timer when the timeout is disabled', async () => {
            jest.spyOn(global, 'setTimeout');
            const fetchMock = mockFetch({ body: [GBR_RECORD] });

            await new E164({ fetch: fetchMock, timeout: 0 }).lookup('+441133910781');

            expect(setTimeout).not.toHaveBeenCalled();
            jest.restoreAllMocks();
        });
    });

    describe('configuration', () => {
        it('rejects an invalid timeout at construction time', () => {
            expect(() => new E164({ timeout: -1 })).toThrow(TypeError);
            expect(() => new E164({ timeout: 'soon' })).toThrow(/non-negative number/);
        });

        it('explains itself when no fetch implementation exists', () => {
            expect(() => new E164({ fetch: null })).toThrow(/No fetch implementation available/);
            expect(() => new E164({ fetch: 'nope' })).toThrow(TypeError);
        });

        it('treats an explicit undefined fetch as "use the default"', () => {
            expect(() => new E164({ fetch: undefined })).not.toThrow();
        });

        it('uses the global fetch by default', () => {
            expect(() => new E164()).not.toThrow();
            expect(new E164().client).toBeNull();
        });

        it('exposes Response from the package root', () => {
            expect(E164.Response).toBe(Response);
            expect(E164.E164).toBe(E164);
        });
    });

    describe('injected axios-style client (v1 compatibility)', () => {
        /** @returns {{get: jest.Mock}} A stand-in for an axios instance. */
        function mockClient(response) {
            return { get: jest.fn().mockResolvedValue(response) };
        }

        it('uses the client with a relative, digits-only path', async () => {
            const client = mockClient({ status: 200, data: [GBR_RECORD] });
            const result = await new E164({ client }).lookup('+441133910781');

            expect(client.get).toHaveBeenCalledTimes(1);
            expect(client.get.mock.calls[0][0]).toBe('/441133910781');
            expect(client.get.mock.calls[0][1]).toMatchObject({ maxRedirects: 0, timeout: 10000 });
            expect(client.get.mock.calls[0][1].validateStatus(404)).toBe(true);
            expect(result.isSuccess()).toBe(true);
            expect(result.calling_code).toBe(44);
        });

        it('takes precedence over a supplied fetch', async () => {
            const client = mockClient({ status: 200, data: [GBR_RECORD] });
            const fetchMock = mockFetch({ body: [GBR_RECORD] });

            await new E164({ client, fetch: fetchMock }).lookup('+441133910781');

            expect(client.get).toHaveBeenCalledTimes(1);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('maps an axios error carrying a response onto that status', async () => {
            const client = {
                get: jest.fn().mockRejectedValue(Object.assign(new Error('Request failed with status code 500'), {
                    response: { status: 500, data: { error: 'Internal Server Error' } },
                })),
            };
            const result = await new E164({ client }).lookup('+441133910781');

            expect(result.statusCode).toBe(500);
            expect(result.error).toBe('Internal Server Error');
            expect(result.rawResponse).toEqual({ status: 500, data: { error: 'Internal Server Error' } });
        });

        it('maps an axios timeout onto 504', async () => {
            const client = {
                get: jest.fn().mockRejectedValue(
                    Object.assign(new Error('timeout of 10ms exceeded'), { code: 'ECONNABORTED' })
                ),
            };
            const result = await new E164({ client, timeout: 10 }).lookup('+441133910781');

            expect(result.statusCode).toBe(504);
            expect(result.error).toBe('timeout of 10ms exceeded');
        });
    });
});

describe('Response', () => {
    it('nulls every field when there is no data', () => {
        const response = new Response(500, null, 'boom', null);

        expect(response.isSuccess()).toBe(false);
        expect(response.data).toBeNull();
        expect(response.results).toEqual([]);
        for (const field of Response.LOOKUP_FIELDS) {
            expect(response[field]).toBeNull();
        }
    });

    it('defaults results to the single record when none is supplied', () => {
        const response = new Response(200, GBR_RECORD, null, null);
        expect(response.results).toEqual([GBR_RECORD]);
    });

    it('nulls fields the record omits entirely', () => {
        const response = new Response(200, { prefix: '44' }, null, null);

        expect(response.prefix).toBe('44');
        expect(response.iso3).toBeNull();
        expect(response.calling_code).toBeNull();
    });

    it.each([
        [199, false],
        [200, true],
        [299, true],
        [300, false],
        [404, false],
        [500, false],
    ])('isSuccess() is %p → %p', (statusCode, expected) => {
        expect(new Response(statusCode, null, null, null).isSuccess()).toBe(expected);
    });

    it('omits the raw HTTP response when serialized', () => {
        const raw = { status: 200, headers: {}, circular: null };
        raw.circular = raw;
        const response = new Response(200, GBR_RECORD, null, raw);

        const serialized = JSON.parse(JSON.stringify(response));

        expect(serialized).not.toHaveProperty('rawResponse');
        expect(serialized.statusCode).toBe(200);
        expect(serialized.iso3).toBe('GBR');
        expect(serialized.calling_code).toBe(44);
        expect(serialized.results).toEqual([GBR_RECORD]);
    });
});
