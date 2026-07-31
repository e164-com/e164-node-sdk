'use strict';

/**
 * The lookup fields the API returns, in the order the API documents them.
 * Values are copied onto the Response for convenience.
 */
const LOOKUP_FIELDS = [
  'prefix',
  'calling_code',
  'iso3',
  'tadig',
  'mccmnc',
  'type',
  'location',
  'operator_brand',
  'operator_company',
  'total_length_min',
  'total_length_max',
  'weight',
  'source',
];

/**
 * Represents a standardized response from the E164 API, including number details
 * when the lookup succeeded.
 */
class Response {
  /**
   * Creates an instance of Response.
   *
   * @param {number} statusCode - The HTTP status code of the response.
   * @param {object|null} data - The best-matching record, if the lookup succeeded.
   * @param {string|null} error - An error message, if the request failed.
   * @param {object|null} rawResponse - The original response object from the HTTP client.
   * @param {Array<object>} [results] - Every record the API returned, most specific
   *   first. Defaults to `[data]` when `data` is present.
   */
  constructor(statusCode, data, error, rawResponse, results) {
    this.statusCode = statusCode;
    this.error = error;
    /**
     * @type {object|null} The original raw response, for debugging or advanced use.
     * Its body has already been read in order to parse it, so on the `fetch`
     * transport `text()`/`json()` throw; `headers` and `status` remain usable.
     */
    this.rawResponse = rawResponse;

    const record = data && typeof data === 'object' ? data : null;

    for (const field of LOOKUP_FIELDS) {
      // `??` rather than `||`: the API returns numbers for calling_code, weight and
      // the length fields, and 0 or "" are real values that must not become null.
      this[field] = record ? (record[field] ?? null) : null;
    }

    /** @type {object|null} The best-matching record, or `null` on failure. */
    this.data = record;
    /** @type {Array<object>} Every record returned, most specific first. */
    this.results = Array.isArray(results) ? results : (record ? [record] : []);
  }

  /**
   * Checks if the response indicates success (a 2xx status code).
   *
   * @returns {boolean} True if the status code is between 200 and 299, false otherwise.
   */
  isSuccess() {
    return this.statusCode >= 200 && this.statusCode < 300;
  }

  /**
   * Serializes the response without `rawResponse`, whose HTTP-client internals are
   * large and not JSON-safe.
   *
   * @returns {object} A plain, JSON-serializable view of the response.
   */
  toJSON() {
    const plain = { statusCode: this.statusCode, error: this.error };
    for (const field of LOOKUP_FIELDS) plain[field] = this[field];
    plain.data = this.data;
    plain.results = this.results;
    return plain;
  }
}

module.exports = Response;
module.exports.LOOKUP_FIELDS = LOOKUP_FIELDS;
