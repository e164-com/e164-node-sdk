'use strict';

/**
 * Integration tests that hit the real e164.com API.
 *
 * These are skipped by default so the unit suite stays offline and deterministic.
 * Run them with `npm run test:live` (or `E164_LIVE=1 npx jest`) before publishing:
 * the v1 `+`-prefix bug passed a fully mocked suite for its entire lifetime, and
 * only a real request would have caught it.
 */

const E164 = require('../index');

const describeLive = process.env.E164_LIVE ? describe : describe.skip;

describeLive('E164 SDK (live API)', () => {
    jest.setTimeout(30000);

    const e164 = new E164({ timeout: 15000 });

    it.each([
        ['+441133910781', 'GBR'],
        ['441133910781', 'GBR'],
        ['+44 113 391 0781', 'GBR'],
        ['+4915112345678', 'DEU'],
        ['+33612345678', 'FRA'],
        ['+12124567890', 'USA'],
    ])('resolves %s to %s', async (input, iso3) => {
        const result = await e164.lookup(input);

        expect(result.error).toBeNull();
        expect(result.isSuccess()).toBe(true);
        expect(result.iso3).toBe(iso3);
        expect(result.prefix).toEqual(expect.any(String));
        expect(result.results.length).toBeGreaterThan(0);
    });

    it('returns the same record with or without a + prefix', async () => {
        const [withPlus, withoutPlus] = await Promise.all([
            e164.lookup('+441133910781'),
            e164.lookup('441133910781'),
        ]);

        expect(withPlus.data).toEqual(withoutPlus.data);
    });

    // Locks in the JSON types the API actually returns; the v1 declarations
    // claimed these were strings.
    it('returns numeric types for calling_code, lengths and weight', async () => {
        const result = await e164.lookup('+441133910781');

        expect(typeof result.calling_code).toBe('number');
        expect(typeof result.total_length_min).toBe('number');
        expect(typeof result.total_length_max).toBe('number');
        expect(typeof result.weight).toBe('number');
        expect(typeof result.iso3).toBe('string');
        expect(typeof result.prefix).toBe('string');
    });

    it('reports an unallocated number as a 404', async () => {
        const result = await e164.lookup('+447700900123');

        expect(result.isSuccess()).toBe(false);
        expect(result.statusCode).toBe(404);
        expect(result.data).toBeNull();
    });

    it('rejects malformed input without touching the network', async () => {
        const result = await e164.lookup('not-a-number');

        expect(result.statusCode).toBe(400);
    });

    it('honours cancellation', async () => {
        const controller = new AbortController();
        const pending = e164.lookup('+441133910781', { signal: controller.signal });
        controller.abort();

        expect((await pending).statusCode).toBe(499);
    });
});
