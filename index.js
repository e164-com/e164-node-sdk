'use strict';

/**
 * E164 Node SDK — a zero-dependency client for the [e164.com](https://e164.com)
 * phone number lookup API.
 *
 * @module e164-node
 * @typicalname e164
 * @example
 * const E164 = require('e164-node');
 * const e164 = new E164();
 *
 * async function run() {
 *   const response = await e164.lookup('+441133910781');
 *   if (response.isSuccess()) {
 *     console.log(response.iso3, response.operator_brand); // GBR BT
 *   } else {
 *     console.error('Lookup failed:', response.statusCode, response.error);
 *   }
 * }
 * run();
 */

const Response = require('./lib/response');
const { version: VERSION } = require('./package.json');

const DEFAULT_BASE_URL = 'https://e164.com';
const DEFAULT_TIMEOUT_MS = 10000;

/** ITU-T E.164 allows a maximum of 15 digits, and no country code starts with 0. */
const E164_PATTERN = /^[1-9]\d{0,14}$/;

/**
 * Reduces caller input to the bare digits the API expects.
 *
 * The API is served from a path segment (`https://e164.com/441133910781`), so
 * cosmetic characters — `+`, spaces, dashes, parentheses, dots — must be removed
 * rather than percent-encoded. Encoding a leading `+` as `%2B` makes the API
 * respond with a 301 to the marketing site instead of JSON.
 *
 * @param {string|number} input - The caller-supplied phone number.
 * @returns {string} The digits contained in `input`, or `''` if there are none.
 */
function toDigits(input) {
  if (typeof input === 'number') {
    // A phone number held in a JS number is only trustworthy while it is an
    // exact integer; anything else has already lost or reformatted digits.
    return Number.isSafeInteger(input) && input > 0 ? String(input) : '';
  }
  if (typeof input === 'bigint') return input > 0n ? String(input) : '';
  if (typeof input !== 'string') return '';
  return input.replace(/\D/g, '');
}

/**
 * Explains why a number is not a usable E.164 number, or returns `null` if it is.
 *
 * @param {string} digits - Output of {@link toDigits}.
 * @param {string|number} original - The caller's original input, for the message.
 * @returns {string|null} A human-readable reason, or `null` when valid.
 */
function describeInvalidNumber(digits, original) {
  if (!digits) {
    return `Invalid phone number: no digits found in ${JSON.stringify(String(original))}. ` +
      'Expected an E.164 number such as "+441133910781".';
  }
  if (digits.length > 15) {
    return `Invalid phone number: E.164 numbers contain at most 15 digits, received ${digits.length}.`;
  }
  if (digits[0] === '0') {
    return 'Invalid phone number: E.164 country codes never start with 0. ' +
      'Drop any national trunk prefix or international access code (e.g. "0044…" should be "+44…").';
  }
  return E164_PATTERN.test(digits) ? null : `Invalid phone number: "${digits}" is not a valid E.164 number.`;
}

class E164 {
  /**
   * Creates an instance of the E164 SDK.
   *
   * @param {object} [options={}] - Configuration options.
   * @param {string} [options.baseUrl='https://e164.com'] - Override the API origin.
   * @param {number} [options.timeout=10000] - Per-request timeout in milliseconds. `0` disables it.
   * @param {Function} [options.fetch=globalThis.fetch] - A `fetch` implementation to use instead of the global one.
   * @param {object} [options.client] - A pre-configured axios-style instance exposing
   *   `get(path, config)`. Supported for backwards compatibility; when supplied it
   *   takes precedence over `options.fetch`.
   * @param {Record<string, string>} [options.headers] - Extra headers merged into every request.
   */
  constructor(options = {}) {
    const {
      baseUrl = DEFAULT_BASE_URL,
      timeout = DEFAULT_TIMEOUT_MS,
      fetch: fetchImpl = globalThis.fetch,
      client = null,
      headers = {},
    } = options;

    if (typeof timeout !== 'number' || Number.isNaN(timeout) || timeout < 0) {
      throw new TypeError('options.timeout must be a non-negative number of milliseconds.');
    }

    /** @type {string} API origin, without a trailing slash. */
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    /** @type {number} Per-request timeout in milliseconds; `0` means no timeout. */
    this.timeout = timeout;
    /** @type {object|null} The injected axios-style client, or `null` when using `fetch`. */
    this.client = client;
    /** @type {Record<string, string>} Headers sent with every request. */
    this.headers = {
      Accept: 'application/json',
      // Retained from v1: the API has historically expected a Referer.
      Referer: 'https://www.e164.com/',
      'User-Agent': `e164-node/${VERSION}`,
      ...headers,
    };

    this._fetch = client ? null : fetchImpl;

    if (!client && typeof this._fetch !== 'function') {
      throw new TypeError(
        'No fetch implementation available. Use Node.js 18 or newer, or pass ' +
        'options.fetch (or an axios-style options.client) explicitly.'
      );
    }
  }

  /**
   * Looks up carrier and country details for a phone number.
   *
   * Never throws for network or API failures: the outcome is always reported
   * through the returned {@link Response}, with `isSuccess()` distinguishing the
   * two cases.
   *
   * @param {string|number} phoneNumber - The number to look up, in any common
   *   formatting (`'+44 113 391 0781'`, `'441133910781'`, …).
   * @param {object} [options={}] - Per-call overrides.
   * @param {number} [options.timeout] - Timeout for this request only.
   * @param {AbortSignal} [options.signal] - Signal used to cancel this request.
   * @returns {Promise<Response>} A promise that resolves with a Response object.
   */
  async lookup(phoneNumber, options = {}) {
    const digits = toDigits(phoneNumber);
    const invalid = describeInvalidNumber(digits, phoneNumber);
    if (invalid) return new Response(400, null, invalid, null);

    const { timeout = this.timeout, signal } = options || {};
    const url = `${this.baseUrl}/${digits}`;

    let result;
    try {
      result = this.client
        ? await this._requestViaClient(digits, { timeout, signal })
        : await this._requestViaFetch(url, { timeout, signal });
    } catch (error) {
      return this._responseForThrown(error, url, timeout);
    }

    const { status, data, parseError, raw } = result;

    // A redirect means the request never reached the JSON endpoint — surface that
    // plainly rather than reporting whatever HTML sits at the other end.
    if (status >= 300 && status < 400) {
      return new Response(
        502,
        null,
        `Unexpected redirect (HTTP ${status}) from ${url}. The API endpoint may have moved.`,
        raw
      );
    }

    if (status < 200 || status >= 300) {
      const apiMessage = data && typeof data === 'object' ? (data.error || data.message) : null;
      return new Response(status, null, apiMessage || `Request failed with status code ${status}.`, raw);
    }

    if (parseError) {
      return new Response(502, null, `Could not parse the API response as JSON: ${parseError}`, raw);
    }

    // The API answers with an array of matching prefix records, most specific first.
    const results = Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : null);
    if (!results) {
      return new Response(502, null, 'Received an unexpected data format from the API.', raw);
    }
    if (results.length === 0) {
      return new Response(404, null, `No records found for "+${digits}".`, raw);
    }

    return new Response(status, results[0], null, raw, results);
  }

  /**
   * Performs the request with the global/injected `fetch`.
   *
   * @private
   * @param {string} url - Absolute request URL.
   * @param {{timeout: number, signal?: AbortSignal}} options - Request controls.
   * @returns {Promise<{status: number, data: any, parseError: string|null, raw: any}>}
   */
  async _requestViaFetch(url, { timeout, signal }) {
    const controller = new AbortController();
    let timedOut = false;

    const abort = () => controller.abort();
    const timer = timeout > 0
      ? setTimeout(() => { timedOut = true; controller.abort(); }, timeout)
      : null;

    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', abort, { once: true });
    }

    // `fetch` is called detached so implementations that brand-check their
    // receiver are not handed this SDK instance as `this`.
    const fetchImpl = this._fetch;

    try {
      const raw = await fetchImpl(url, {
        method: 'GET',
        headers: this.headers,
        redirect: 'manual',
        signal: controller.signal,
      });

      // Read the body inside the same window: a response whose headers arrive
      // promptly can still stall forever while streaming.
      const body = await raw.text();

      if (body.trim() === '') return { status: raw.status, data: null, parseError: null, raw };

      try {
        return { status: raw.status, data: JSON.parse(body), parseError: null, raw };
      } catch (error) {
        return { status: raw.status, data: body, parseError: error.message, raw };
      }
    } catch (error) {
      if (timedOut) {
        const timeoutError = new Error(`Request timed out after ${timeout}ms.`);
        timeoutError.code = 'ETIMEDOUT';
        throw timeoutError;
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abort);
    }
  }

  /**
   * Performs the request with a caller-supplied axios-style client.
   *
   * @private
   * @param {string} digits - The validated, digits-only number.
   * @param {{timeout: number, signal?: AbortSignal}} options - Request controls.
   * @returns {Promise<{status: number, data: any, parseError: string|null, raw: any}>}
   */
  async _requestViaClient(digits, { timeout, signal }) {
    const raw = await this.client.get(`/${digits}`, {
      // Let this method decide how each status is reported.
      validateStatus: () => true,
      maxRedirects: 0,
      timeout,
      signal,
    });
    return { status: raw.status, data: raw.data, parseError: null, raw };
  }

  /**
   * Maps a thrown transport error onto a failed {@link Response}.
   *
   * @private
   * @param {Error & {code?: string, name?: string, response?: any}} error - The thrown error.
   * @param {string} url - The URL that was being requested.
   * @param {number} timeout - The timeout in force for the request.
   * @returns {Response} A failed response describing the error.
   */
  _responseForThrown(error, url, timeout) {
    // axios clients reject on 5xx and expose the response they received.
    if (error && error.response && typeof error.response.status === 'number') {
      const data = error.response.data;
      const apiMessage = data && typeof data === 'object' ? (data.error || data.message) : null;
      return new Response(error.response.status, null, apiMessage || error.message, error.response);
    }

    const isTimeout = error && (
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNABORTED' ||
      error.name === 'TimeoutError'
    );
    if (isTimeout) {
      return new Response(504, null, error.message || `Request timed out after ${timeout}ms.`, null);
    }

    // 'CanceledError'/'ERR_CANCELED' are how axios reports an aborted request.
    const isCancelled = error && (
      error.name === 'AbortError' ||
      error.name === 'CanceledError' ||
      error.code === 'ERR_CANCELED'
    );
    if (isCancelled) {
      return new Response(499, null, 'Request was cancelled.', null);
    }

    const cause = error && error.cause && error.cause.message ? ` (${error.cause.message})` : '';
    const message = error && error.message ? error.message : 'An unexpected error occurred during lookup.';
    return new Response(500, null, `${message}${cause}`, null);
  }
}

module.exports = E164;
module.exports.E164 = E164;
module.exports.Response = Response;
