# E164 Node SDK

E164 Node SDK is a node package for interacting with the [e164.com](https://e164.com) API. It provides a simple interface to perform phone number lookups.

## Installation

Install the package using npm or yarn:

```bash
npm install e164-node axios
```

or

```bash
yarn add e164-node axios
```

*(Note: `axios` is a peer dependency used for making HTTP requests).*

## Usage

Import the `E164` class, create an instance, and use the `lookup` method.

```javascript
const E164 = require('e164-node');

// Create an instance
const e164 = new E164();
// API Key option removed as it's not needed

async function lookupNumber(phoneNumber) {
  try {
    const response = await e164.lookup(phoneNumber);

    if (response.isSuccess()) {
      console.log('Lookup Successful!');
      console.log('Status Code:', response.statusCode);
      console.log('Prefix:', response.prefix);
      console.log('Calling Code:', response.calling_code);
      console.log('ISO3:', response.iso3);
      console.log('Type:', response.type);
      console.log('Operator Brand:', response.operator_brand);
      // Access other properties like:
      // tadig, mccmnc, location, operator_company, total_length_min,
      // total_length_max, weight, source
      // console.log('Full Data:', response.data); // Access the original data object
    } else {
      console.error('Lookup Failed!');
      console.error('Status Code:', response.statusCode);
      console.error('Error:', response.error);
    }
    // You can also access the raw axios response object if needed
    // console.log('Raw Response:', response.rawResponse);

  } catch (error) {
    // This catch block handles unexpected errors *before* a Response object is created
    // (e.g., issues within the SDK itself, though most errors are wrapped in the Response object)
    console.error('An unexpected error occurred:', error);
  }
}

// Example usage:
lookupNumber('+14155552671');
lookupNumber('441133910781');
lookupNumber('invalid-number'); // Example of an invalid input
```

### Response Object

The `lookup` method returns a `Response` object with the following key properties:

*   `statusCode` (Number): The HTTP status code of the API response.
*   `data` (Object | null): The parsed JSON data from the API response if successful. Contains details about the number.
*   `error` (String | null): An error message if the request failed or the status code was not successful (non-2xx).
*   `rawResponse` (Object | null): The raw response object from the underlying HTTP client (`axios` by default). Useful for accessing headers or other low-level details.
*   `isSuccess()` (Function): Returns `true` if the `statusCode` is between 200 and 299 (inclusive), `false` otherwise.

If the lookup is successful (`isSuccess()` is true), the `Response` object will also have top-level properties corresponding to the fields returned by the API, such as:

*   `prefix`
*   `calling_code`
*   `iso3`
*   `tadig`
*   `mccmnc`
*   `type`
*   `location`
*   `operator_brand`
*   `operator_company`
*   `total_length_min`
*   `total_length_max`
*   `weight`
*   `source`

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/e164-com/e164-node-sdk).

## License

[ISC](LICENSE) (Assuming ISC based on package.json - create a LICENSE file if needed)
