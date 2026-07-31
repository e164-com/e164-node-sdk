# Changelog

All notable changes to this project are documented in this file. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 2.0.1

### Fixed

- **`AbortSignal.timeout()` was reported as a cancellation (`499`) rather than a
  timeout (`504`).** Aborting the SDK's internal controller discarded the caller
  signal's reason, so a deadline was indistinguishable from a manual `abort()` —
  including for the `signal: AbortSignal.timeout(2000)` pattern the README documents.
  A custom abort reason still reports `499`.

### Documentation

- Documented the API's rate limiting: it is a token bucket emptied by concurrency,
  the `429` carries no `Retry-After`, and recovery takes tens of seconds. Added a
  sequential batching recipe with second-scale backoff.
- Documented that `response.rawResponse` has an already-consumed body, so `text()`
  and `json()` throw on the `fetch` transport while `headers` and `status` work.

## 2.0.0

### Fixed

- **Numbers in E.164 form (`+441133910781`) never worked.** The number was passed
  through `encodeURIComponent`, turning the leading `+` into `%2B`. The API answers
  that path with a `301` to the marketing site, so the SDK parsed an HTML page and
  returned `500 "Received unexpected data format from API."` — for the exact format
  the package is named after, and for the first example in the v1 README. Input is
  now reduced to digits before the URL is built.
- **The package was uninstallable on its own.** `axios` was required at runtime but
  declared only in `devDependencies`, so `npm install e164-node` produced a package
  that threw `MODULE_NOT_FOUND` on `require`. There is no longer a runtime dependency.
- **The type declarations did not compile.** `index.d.ts` and `lib/response.d.ts`
  imported types from `axios`, which consumers had no reason to have installed, and
  `lib/response.d.ts` combined `export =` with other exports, which TypeScript
  rejects outright.
- **Declared field types were wrong.** `calling_code`, `total_length_min`,
  `total_length_max` and `weight` are JSON numbers, not strings.
- **Falsy values were discarded.** Fields were copied with `||`, so a legitimate
  `0` or `""` became `null`. They are now copied with `??`.
- Requests had no timeout and could hang indefinitely.
- Malformed input was passed to the API rather than rejected. `'invalid-number'`
  became the request path `/-`, which returned an HTML redirect.

### Added

- Per-request `timeout` and `signal` options: `lookup(number, { timeout, signal })`.
- `baseUrl`, `headers` and `fetch` constructor options.
- `response.results`, exposing every record the API returned rather than only the
  best match. `response.data` remains the most specific match.
- `response.toJSON()`, so `JSON.stringify(response)` no longer serializes the
  entire raw HTTP response.
- Distinct status codes for failure modes that were previously all `500`: `499`
  cancelled, `502` unusable API reply (redirect or non-JSON), `504` timed out.
- Named exports `E164.E164` and `E164.Response` for ESM interop.
- Live integration tests (`npm run test:live`), a type-declaration check
  (`npm run typecheck`), and the `LICENSE` file the README already referenced.

### Changed

- **Requests now use the built-in `fetch`** instead of axios. Node.js 18 or newer
  is required. Passing an axios instance via `options.client` is still supported.
- Redirects are no longer followed, so an HTML page can never be mistaken for data.
- The `Referer` header sent in v1 is retained; `Accept` and `User-Agent` were added.

### Migration

`npm install e164-node axios` becomes `npm install e164-node`. No code changes are
needed unless you relied on one of these:

- `response.rawResponse` is a `fetch` `Response`, not an `AxiosResponse`, unless you
  supply `options.client`.
- `e164.client` is `null` unless you supply `options.client`.
- Timeouts and cancellations report `504`/`499` instead of `500`.
- Malformed input now returns `400` without a request, where v1 forwarded it to the
  API and typically surfaced the resulting `404`.

## 1.0.1

- Initial public release.
