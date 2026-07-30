# E164 Node SDK

A zero-dependency Node.js SDK for the [e164.com](https://e164.com) phone number lookup API. Give it a phone number, get back the country, number type, and operator behind it.

## Installation

```bash
npm install e164-node
```

No runtime dependencies — the SDK uses the built-in `fetch`, so Node.js 18 or newer is all you need.

## Usage

```javascript
const E164 = require('e164-node');

const e164 = new E164();

async function lookupNumber(phoneNumber) {
  const response = await e164.lookup(phoneNumber);

  if (!response.isSuccess()) {
    console.error('Lookup failed:', response.statusCode, response.error);
    return;
  }

  console.log('Prefix:        ', response.prefix);          // '44113391'
  console.log('Calling code:  ', response.calling_code);    // 44
  console.log('Country (ISO3):', response.iso3);            // 'GBR'
  console.log('Type:          ', response.type);            // 'GEOGRAPHIC'
  console.log('Operator:      ', response.operator_brand);  // 'BT'
}

lookupNumber('+441133910781');
```

ES modules work too:

```javascript
import E164 from 'e164-node';

const e164 = new E164();
const response = await e164.lookup('+441133910781');
```

`lookup()` never throws for network or API failures. Every outcome — invalid input, an unknown number, a timeout, a dead connection — comes back as a `Response`, and `isSuccess()` tells the two apart.

### Number formats

Pass numbers however you have them. The SDK reduces input to the digits the API expects, so `+`, spaces, dashes, dots and parentheses are all fine:

```javascript
await e164.lookup('+441133910781');
await e164.lookup('441133910781');
await e164.lookup('+44 113 391 0781');
await e164.lookup('+44-113-391-0781');
await e164.lookup(441133910781);        // numbers are accepted too
```

Input that cannot be an [E.164](https://en.wikipedia.org/wiki/E.164) number is rejected locally with a `400`, without a network round trip — no digits at all, more than 15 digits, or a leading `0` (E.164 country codes never start with one, so strip any trunk prefix or international access code: `0044…` should be `+44…`).

## Configuration

```javascript
const e164 = new E164({
  timeout: 5000,                       // per-request timeout in ms (default 10000; 0 disables)
  baseUrl: 'https://e164.com',         // override the API origin
  headers: { 'X-Trace-Id': 'abc123' }, // extra headers on every request
  fetch: myFetch,                      // custom fetch implementation
});
```

| Option    | Type                      | Default              | Description |
| --------- | ------------------------- | -------------------- | ----------- |
| `timeout` | `number`                  | `10000`              | Per-request timeout in milliseconds. `0` disables it. |
| `baseUrl` | `string`                  | `https://e164.com`   | API origin. Trailing slashes are trimmed. |
| `headers` | `Record<string, string>`  | —                    | Extra headers merged into every request. |
| `fetch`   | `typeof fetch`            | `globalThis.fetch`   | A `fetch` implementation to use instead of the global one. |
| `client`  | `{ get(path, config) }`   | —                    | An axios-style instance, for v1 compatibility. Takes precedence over `fetch`. |

### Per-request options

```javascript
const response = await e164.lookup('+441133910781', {
  timeout: 2000,
  signal: AbortSignal.timeout(2000),
});
```

| Option    | Type          | Description |
| --------- | ------------- | ----------- |
| `timeout` | `number`      | Timeout for this request only. |
| `signal`  | `AbortSignal` | Cancels this request. A cancelled lookup resolves with status `499`. |

## Response object

| Property      | Type                | Description |
| ------------- | ------------------- | ----------- |
| `statusCode`  | `number`            | HTTP status, or an SDK-assigned status for local failures. |
| `error`       | `string \| null`    | Error message, or `null` on success. |
| `data`        | `object \| null`    | The best-matching record, or `null` on failure. |
| `results`     | `object[]`          | Every record returned, most specific first. Empty on failure. |
| `rawResponse` | `object \| null`    | The underlying HTTP response, for headers and other low-level details. |
| `isSuccess()` | `() => boolean`     | `true` when `statusCode` is 2xx. |
| `toJSON()`    | `() => object`      | A JSON-safe view, omitting `rawResponse`. |

On success, the fields of the best-matching record are also copied onto the response itself:

| Field              | Type              | Example |
| ------------------ | ----------------- | ------- |
| `prefix`           | `string \| null`  | `'44113391'` |
| `calling_code`     | `number \| null`  | `44` |
| `iso3`             | `string \| null`  | `'GBR'` |
| `tadig`            | `string \| null`  | `'DEUD1'` |
| `mccmnc`           | `string \| null`  | `'23450'` |
| `type`             | `string \| null`  | `'GEOGRAPHIC'`, `'MOBILE'` |
| `location`         | `string \| null`  | `'France'` |
| `operator_brand`   | `string \| null`  | `'BT'` |
| `operator_company` | `string \| null`  | `'BT'` |
| `total_length_min` | `number \| null`  | `12` |
| `total_length_max` | `number \| null`  | `12` |
| `weight`           | `number \| null`  | `11` |
| `source`           | `string \| null`  | `'e164.com'` |

> `calling_code`, `total_length_min`, `total_length_max` and `weight` are JSON **numbers**. (The v1 type declarations wrongly described them as strings.)

### Status codes

| Status | Meaning |
| ------ | ------- |
| `200`  | Match found. |
| `400`  | Input rejected locally; no request was made. |
| `404`  | The API has no record for this number. |
| `499`  | The request was cancelled via an `AbortSignal`. |
| `500`  | Network or unexpected error. |
| `502`  | The API replied with something unusable — a redirect, or a body that is not JSON. |
| `504`  | The request timed out. |

Any other status is passed through from the API as-is.

## TypeScript

Type declarations ship with the package; no `@types` install is needed.

```typescript
import E164 = require('e164-node');
import Response = require('e164-node/lib/response');

const e164 = new E164({ timeout: 5000 });
const response: Response = await e164.lookup('+441133910781');

if (response.isSuccess()) {
  const record: Response.E164LookupData | null = response.data;
  const callingCode: number | null = response.calling_code;
}
```

## Development

```bash
npm install
npm test          # unit tests — fully offline
npm run test:live # integration tests against the real API
npm run typecheck # verify the published .d.ts files compile
npm run check     # typecheck + unit tests
```

`npm run test:live` is worth running before every publish. The v1 `+`-prefix bug passed a fully mocked suite for its whole lifetime; only a real request exposed it.

## Migrating from v1

v1 required `axios` as a separate install and was broken for any number written in E.164 form. See [CHANGELOG.md](CHANGELOG.md) for the full list of changes.

For most users the upgrade is:

```diff
-npm install e164-node axios
+npm install e164-node
```

with no code changes. If you passed a custom axios instance via `options.client`, that still works.

## Contributing

Contributions are welcome — please open an issue or pull request on [GitHub](https://github.com/e164-com/e164-node-sdk).

## License

[ISC](LICENSE)
