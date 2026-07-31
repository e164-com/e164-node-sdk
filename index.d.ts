import Response = require('./lib/response');

/** The minimal axios-compatible surface the SDK uses when a client is injected. */
interface HttpClientLike {
    get(path: string, config?: Record<string, unknown>): Promise<{ status: number; data: unknown }>;
}

/** Configuration options for the E164 SDK constructor. */
interface E164Options {
    /** Override the API origin. Defaults to `https://e164.com`. */
    baseUrl?: string;
    /** Per-request timeout in milliseconds. Defaults to `10000`; `0` disables it. */
    timeout?: number;
    /** A `fetch` implementation to use instead of `globalThis.fetch`. */
    fetch?: typeof globalThis.fetch;
    /**
     * A pre-configured axios-style instance exposing `get(path, config)`. Supported
     * for backwards compatibility; takes precedence over `fetch` when supplied.
     */
    client?: HttpClientLike;
    /** Extra headers merged into every request. */
    headers?: Record<string, string>;
}

/** Per-call overrides for {@link E164.lookup}. */
interface E164LookupOptions {
    /** Timeout for this request only, in milliseconds. */
    timeout?: number;
    /**
     * Signal used to cancel this request. A cancelled lookup resolves with status
     * `499`, except for `AbortSignal.timeout()`, whose deadline resolves with `504`.
     */
    signal?: AbortSignal;
}

/** E164 Node SDK client. */
declare class E164 {
    /** API origin, without a trailing slash. */
    readonly baseUrl: string;
    /** Per-request timeout in milliseconds; `0` means no timeout. */
    readonly timeout: number;
    /** The injected axios-style client, or `null` when using `fetch`. */
    readonly client: HttpClientLike | null;
    /** Headers sent with every request. */
    readonly headers: Record<string, string>;

    /**
     * Creates an instance of the E164 SDK.
     *
     * @param options - Configuration options.
     */
    constructor(options?: E164Options);

    /**
     * Looks up carrier and country details for a phone number.
     *
     * Never rejects for network or API failures — inspect `isSuccess()` on the
     * resolved {@link Response} instead.
     *
     * @param phoneNumber - The number to look up, in any common formatting.
     * @param options - Per-call overrides.
     * @returns A promise that resolves with a Response object.
     */
    lookup(phoneNumber: string | number, options?: E164LookupOptions): Promise<Response>;
}

declare namespace E164 {
    export { E164, Response, E164Options, E164LookupOptions, HttpClientLike };
}

export = E164;
