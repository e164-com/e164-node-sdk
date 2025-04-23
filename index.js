/**
 * E164 Node SDK
 *
 * @module e164-node
 * @typicalname e164
 * @example
 * const E164 = require('e164-node');
 * const e164 = new E164(); // Create an instance
 *
 * async function run() {
 *   try {
 *     const response = await e164.lookup('+14155552671');
 *     if (response.isSuccess()) {
 *       console.log('Lookup successful:', response);
 *     } else {
 *       console.error('Lookup failed:', response.statusCode, response.error);
 *     }
 *   } catch (error) {
 *     console.error('An error occurred:', error);
 *   }
 * }
 * run();
 */

const axios = require('axios'); // Make sure to install axios: npm install axios
const Response = require('./lib/response');

const BASE_URL = 'https://e164.com/';

class E164 {
  /**
   * Creates an instance of the E164 SDK.
   * @param {object} [options={}] - Configuration options.
   * @param {object} [options.client] - An optional pre-configured axios instance.
   */
  constructor(options = {}) {
    // API Key removed as it's not needed for the public API

    if (options.client) {
        this.client = options.client;
    } else {
        this.client = axios.create({
            baseURL: BASE_URL,
            headers: {
                'Referer': 'https://www.e164.com/', 
            }
        });
    }
  }

  /**
   * Performs a lookup for a given phone number.
   * @param {string} phoneNumber - The phone number to look up.
   * @returns {Promise<Response>} A promise that resolves with a Response object.
   */
  async lookup(phoneNumber) {
    let rawResponse;
    try {
      // Sanitize the number (allow digits, +, -)
      const sanitizedNumber = String(phoneNumber).replace(/[^\d+-]/g, '');
      if (!sanitizedNumber) {
          // Return a failure Response object for invalid input
          return new Response(400, null, 'Invalid phone number format provided.', null);
      }

      const url = `/${encodeURIComponent(sanitizedNumber)}`; // Use relative URL with baseURL

      rawResponse = await this.client.get(url, {
          validateStatus: function (status) {
              // Consider all statuses valid here, handle specific logic below
              return status >= 200 && status < 500; // Accept 2xx, 3xx, 4xx
          },
      });

      let data = rawResponse.data;

      // Handle non-2xx status codes
      if (rawResponse.status < 200 || rawResponse.status >= 300) {
          const errorMessage = (data && data.error) ? data.error : `Request failed with status code ${rawResponse.status}`;
          return new Response(rawResponse.status, null, errorMessage, rawResponse);
      }

      // Check if data is empty or not as expected
      if (!data || (Array.isArray(data) && data.length === 0)) {
          // Treat as not found or invalid number based on API behavior
          return new Response(404, null, 'Phone number not found or invalid.', rawResponse);
      }

      if (Array.isArray(data) && data.length > 0) {
        data = data[0];
      }

      // Ensure data is an object before creating the Response
      if (typeof data !== 'object' || data === null) {
          return new Response(500, null, 'Received unexpected data format from API.', rawResponse);
      }

      // Create a success Response object
      return new Response(rawResponse.status, data, null, rawResponse);

    } catch (error) {
        // Handle network errors or other exceptions during the request
        const status = (error.response && error.response.status) || 500;
        const message = error.message || 'An unexpected error occurred during lookup.';
        return new Response(status, null, message, error.response || rawResponse || null);
    }
  }
}

module.exports = E164;
