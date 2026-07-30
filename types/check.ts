/**
 * Compile-time check that the published type declarations are valid and usable.
 *
 * Run with `npm run typecheck`. This file is never published or executed — it
 * exists so that a broken `.d.ts` (a missing dependency, a wrong field type, an
 * illegal `export =` combination) fails CI instead of a consumer's build.
 */

import E164 = require('../index');
import Response = require('../lib/response');

// Constructing with no options, and with every documented option.
const bare = new E164();
const configured = new E164({
    baseUrl: 'https://e164.com',
    timeout: 5000,
    headers: { 'X-Trace-Id': 'abc' },
    fetch: globalThis.fetch,
});

// An axios-style client still satisfies the documented `client` option.
const injected = new E164({
    client: {
        get: async (path: string, config?: Record<string, unknown>) => {
            void path;
            void config;
            return { status: 200, data: [] as unknown };
        },
    },
});

// Readonly instance surface.
const origin: string = bare.baseUrl;
const timeoutMs: number = bare.timeout;
const headers: Record<string, string> = bare.headers;
const client: E164.HttpClientLike | null = injected.client;

async function main(): Promise<void> {
    const response: Response = await configured.lookup('+441133910781');
    const cancellable: Response = await configured.lookup(441133910781, {
        timeout: 1000,
        signal: AbortSignal.timeout(1000),
    });

    if (!response.isSuccess()) {
        const message: string | null = response.error;
        void message;
        return;
    }

    // Scalars the API returns as JSON numbers must be typed as numbers.
    const callingCode: number | null = response.calling_code;
    const minLength: number | null = response.total_length_min;
    const maxLength: number | null = response.total_length_max;
    const weight: number | null = response.weight;

    // Scalars the API returns as JSON strings.
    const prefix: string | null = response.prefix;
    const iso3: string | null = response.iso3;
    const numberType: string | null = response.type;
    const brand: string | null = response.operator_brand;

    // `data` is the best match; `results` holds every record returned.
    const record: Response.E164LookupData | null = response.data;
    const all: Response.E164LookupData[] = response.results;
    const serialized: Response.E164ResponseJSON = response.toJSON();

    void [
        cancellable, callingCode, minLength, maxLength, weight,
        prefix, iso3, numberType, brand, record, all, serialized,
    ];
}

// Response is re-exported from the package root, and constructible directly.
const manual: Response = new E164.Response(404, null, 'No records found.', null);

// The class is also reachable as a named export, for ESM interop.
const named: typeof E164 = E164.E164;

void [origin, timeoutMs, headers, client, main, manual, named];
