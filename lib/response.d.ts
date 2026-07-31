/**
 * A single lookup record as returned by the API.
 *
 * Note that `calling_code`, the `total_length_*` fields and `weight` are returned
 * as JSON numbers, not strings.
 */
interface E164LookupData {
    /** The matched dialling prefix, e.g. `"44113391"`. */
    prefix: string | null;
    /** The country calling code, e.g. `44`. */
    calling_code: number | null;
    /** ISO 3166-1 alpha-3 country code, e.g. `"GBR"`. */
    iso3: string | null;
    /** GSMA TADIG code, e.g. `"DEUD1"`. */
    tadig: string | null;
    /** Mobile country/network code, e.g. `"23450"`. */
    mccmnc: string | null;
    /** Number type, e.g. `"MOBILE"` or `"GEOGRAPHIC"`. */
    type: string | null;
    /** Free-text location, when known. */
    location: string | null;
    /** Short operator brand name, e.g. `"BT"`. */
    operator_brand: string | null;
    /** Full operator company name. */
    operator_company: string | null;
    /** Minimum total number length, in digits. */
    total_length_min: number | null;
    /** Maximum total number length, in digits. */
    total_length_max: number | null;
    /** Match confidence weight. */
    weight: number | null;
    /** Data source, e.g. `"e164.com"`. */
    source: string | null;
    /** Allow for fields the API adds in future. */
    [key: string]: unknown;
}

/** A JSON-serializable view of a {@link Response}, without `rawResponse`. */
interface E164ResponseJSON {
    statusCode: number;
    error: string | null;
    data: E164LookupData | null;
    results: E164LookupData[];
    prefix: string | null;
    calling_code: number | null;
    iso3: string | null;
    tadig: string | null;
    mccmnc: string | null;
    type: string | null;
    location: string | null;
    operator_brand: string | null;
    operator_company: string | null;
    total_length_min: number | null;
    total_length_max: number | null;
    weight: number | null;
    source: string | null;
}

/**
 * Represents a standardized response from the E164 API, including number details
 * when the lookup succeeded.
 */
declare class Response {
    /** The HTTP status code of the response. */
    statusCode: number;
    /** An error message, if the request failed. */
    error: string | null;
    /**
     * The original raw response object from the HTTP client — a `fetch` `Response`
     * by default, or your client's response when one is injected.
     *
     * Its body has already been consumed in order to parse it, so on the `fetch`
     * transport `text()` and `json()` throw `Body is unusable`. Read `headers` and
     * `status` from here; read the body from `data` or `results`.
     */
    rawResponse: unknown;
    /** The best-matching record, or `null` when the lookup failed. */
    data: E164LookupData | null;
    /** Every record the API returned, most specific first; empty on failure. */
    results: E164LookupData[];

    // Fields copied from `data` when the lookup succeeded.
    prefix: string | null;
    calling_code: number | null;
    iso3: string | null;
    tadig: string | null;
    mccmnc: string | null;
    type: string | null;
    location: string | null;
    operator_brand: string | null;
    operator_company: string | null;
    total_length_min: number | null;
    total_length_max: number | null;
    weight: number | null;
    source: string | null;

    /**
     * Creates an instance of Response.
     *
     * @param statusCode - The HTTP status code of the response.
     * @param data - The best-matching record, if the lookup succeeded.
     * @param error - An error message, if the request failed.
     * @param rawResponse - The original response object from the HTTP client.
     * @param results - Every record the API returned. Defaults to `[data]`.
     */
    constructor(
        statusCode: number,
        data: E164LookupData | null,
        error: string | null,
        rawResponse?: unknown,
        results?: E164LookupData[]
    );

    /**
     * Checks if the response indicates success (a 2xx status code).
     *
     * @returns True if the status code is between 200 and 299, false otherwise.
     */
    isSuccess(): boolean;

    /** Serializes the response without the raw HTTP-client response. */
    toJSON(): E164ResponseJSON;
}

declare namespace Response {
    export { E164LookupData, E164ResponseJSON };
    /** The lookup field names copied onto every Response. */
    export const LOOKUP_FIELDS: readonly string[];
}

export = Response;
