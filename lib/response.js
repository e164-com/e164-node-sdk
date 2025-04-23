/**
 * Represents a standardized response from the E164 API, potentially including number details.
 */
class Response {
  /**
   * Creates an instance of Response.
   * @param {number} statusCode - The HTTP status code of the response.
   * @param {object|null} data - The data payload of the response, if successful. Should contain properties like prefix, calling_code, etc.
   * @param {string|null} error - An error message, if the request failed.
   * @param {object|null} rawResponse - The original raw response object from the HTTP client.
   */
  constructor(statusCode, data, error, rawResponse) {
    this.statusCode = statusCode;
    this.error = error;
    this.rawResponse = rawResponse; // Optional: include for debugging or advanced use cases

    // Assign data properties directly to the response object if data exists
    if (data && typeof data === 'object') {
        this.prefix = data.prefix || null;
        this.calling_code = data.calling_code || null;
        this.iso3 = data.iso3 || null;
        this.tadig = data.tadig || null;
        this.mccmnc = data.mccmnc || null;
        this.type = data.type || null;
        this.location = data.location || null;
        this.operator_brand = data.operator_brand || null;
        this.operator_company = data.operator_company || null;
        this.total_length_min = data.total_length_min || null;
        this.total_length_max = data.total_length_max || null;
        this.weight = data.weight || null;
        this.source = data.source || null;
        // Keep the original data object as well, if needed
        this.data = data;
    } else {
        // Initialize properties to null if no data is provided
        this.prefix = null;
        this.calling_code = null;
        this.iso3 = null;
        this.tadig = null;
        this.mccmnc = null;
        this.type = null;
        this.location = null;
        this.operator_brand = null;
        this.operator_company = null;
        this.total_length_min = null;
        this.total_length_max = null;
        this.weight = null;
        this.source = null;
        this.data = null;
    }
  }

  /**
   * Checks if the response indicates success (typically status code 2xx).
   * @returns {boolean} True if the status code is between 200 and 299, false otherwise.
   */
  isSuccess() {
    return this.statusCode >= 200 && this.statusCode < 300;
  }
}

module.exports = Response;
