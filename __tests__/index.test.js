const axios = require('axios');
const E164 = require('../index');
const Response = require('../lib/response');

// Mock the axios module
jest.mock('axios');

// Create a mock axios instance to spy on
const mockAxiosInstance = {
    get: jest.fn(),
    // Add other methods like post, put, delete if needed for future tests
};
axios.create.mockReturnValue(mockAxiosInstance); // Mock axios.create() to return our mock instance

describe('E164 SDK', () => {
    let e164;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        // Re-create the mock instance behavior for each test if needed
        axios.create.mockReturnValue(mockAxiosInstance);
        e164 = new E164({ client: mockAxiosInstance }); // Use the mocked client directly
    });

    // Test case corresponding to Python's test_lookup_valid_number
    it('should lookup a valid number and return correct Response data', async () => {
        const testNumber = '441133910781';
        const sanitizedNumber = '441133910781'; // Assuming simple digit string
        const expectedUrl = `/${encodeURIComponent(sanitizedNumber)}`;
        const mockApiData = {
            prefix: "44113391",
            calling_code: "44",
            iso3: "GBR",
            tadig: null,
            mccmnc: "234",
            type: "GEOGRAPHIC",
            location: null,
            operator_brand: "BT",
            operator_company: "BT",
            total_length_min: "12",
            total_length_max: "12",
            weight: "11",
            source: "e164.com",
        };
        const mockRawResponse = {
            status: 200,
            data: mockApiData, // API returns the object directly
            headers: {},
            config: {},
            statusText: 'OK'
        };
        mockAxiosInstance.get.mockResolvedValue(mockRawResponse);

        // Call the method
        const result = await e164.lookup(testNumber);

        // Assertions
        expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
        expect(mockAxiosInstance.get).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
        expect(result).toBeInstanceOf(Response);
        expect(result.isSuccess()).toBe(true);
        expect(result.statusCode).toBe(200);
        expect(result.error).toBeNull();

        // Assert data fields
        expect(result.prefix).toBe("44113391");
        expect(result.calling_code).toBe("44");
        expect(result.iso3).toBe("GBR");
        expect(result.tadig).toBeNull();
        expect(result.mccmnc).toBe("234");
        expect(result.type).toBe("GEOGRAPHIC");
        expect(result.location).toBeNull();
        expect(result.operator_brand).toBe("BT");
        expect(result.operator_company).toBe("BT");
        expect(result.total_length_min).toBe("12");
        expect(result.total_length_max).toBe("12");
        expect(result.weight).toBe("11");
        expect(result.source).toBe("e164.com");
        expect(result.data).toEqual(mockApiData); // Check original data object
        expect(result.rawResponse).toBe(mockRawResponse);
    });

    // Test case corresponding to Python's test_lookup_invalid_number
    // Node implementation returns a Response object with error details, not throws.
    // We simulate the API returning a 404 for an invalid/unfound number.
    it('should handle invalid/unfound number lookup (API returns 404)', async () => {
        const testNumber = '000000000';
        const sanitizedNumber = '000000000';
        const expectedUrl = `/${encodeURIComponent(sanitizedNumber)}`;
        const mockRawResponse = {
            status: 404,
            data: { error: 'Not Found' }, // Simulate API error response
            headers: {},
            config: {},
            statusText: 'Not Found'
        };
        // Mock get to resolve with the 404 response (because validateStatus allows it)
        mockAxiosInstance.get.mockResolvedValue(mockRawResponse);

        // Call the method
        const result = await e164.lookup(testNumber);

        // Assertions
        expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
        expect(mockAxiosInstance.get).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
        expect(result).toBeInstanceOf(Response);
        expect(result.isSuccess()).toBe(false);
        expect(result.statusCode).toBe(404);
        // Check the error message derived from the API response or status code
        expect(result.error).toMatch(/Not Found|Request failed with status code 404/); // Allow for different error messages
        expect(result.data).toBeNull();
        expect(result.rawResponse).toBe(mockRawResponse);
    });

    // Test case corresponding to Python's test_lookup_http_error
    // Node implementation returns a Response object with error details, not throws.
    // We simulate a network error or other exception during the request.
    it('should handle HTTP errors during lookup', async () => {
        const testNumber = '+1234567890';
        const sanitizedNumber = '+1234567890';
        const expectedUrl = `/${encodeURIComponent(sanitizedNumber)}`;
        const httpError = new Error("Network Error"); // Simulate network failure

        // Mock get to reject
        mockAxiosInstance.get.mockRejectedValue(httpError);

        // Call the method
        const result = await e164.lookup(testNumber);

        // Assertions
        expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
        expect(mockAxiosInstance.get).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
        expect(result).toBeInstanceOf(Response);
        expect(result.isSuccess()).toBe(false);
        expect(result.statusCode).toBe(500); // Default status for caught exceptions
        expect(result.error).toBe("Network Error"); // Error message from the exception
        expect(result.data).toBeNull();
        expect(result.rawResponse).toBeNull(); // No response object available in this case
    });

     // Add a test case for axios error with a response (e.g., 500 Internal Server Error)
     it('should handle HTTP server errors (e.g., 500) during lookup', async () => {
        const testNumber = '+1999999999';
        const sanitizedNumber = '+1999999999';
        const expectedUrl = `/${encodeURIComponent(sanitizedNumber)}`;
        const serverError = new Error("Request failed with status code 500");
        serverError.response = { // Simulate axios error structure with a response
            status: 500,
            data: { error: 'Internal Server Error' },
            headers: {},
            config: {},
            statusText: 'Internal Server Error'
        };

        // Mock get to reject with the structured error
        mockAxiosInstance.get.mockRejectedValue(serverError);

        // Call the method
        const result = await e164.lookup(testNumber);

        // Assertions
        expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
        expect(mockAxiosInstance.get).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
        expect(result).toBeInstanceOf(Response);
        expect(result.isSuccess()).toBe(false);
        expect(result.statusCode).toBe(500);
        expect(result.error).toBe("Request failed with status code 500"); // Error message from the exception
        expect(result.data).toBeNull();
        expect(result.rawResponse).toBe(serverError.response); // Should capture the response object
    });

    // Keep other useful tests from the previous version if desired, e.g.:
    describe('Input Sanitization and Handling', () => {
        it('should return a failure Response for invalid phone number format input', async () => {
            const testInput = 'invalid-number';
            const sanitizedInput = '-'; // Result of String(testInput).replace(/[^\d+-]/g, '')
            const expectedUrl = `/${encodeURIComponent(sanitizedInput)}`; // Will be '/-'

            // Mock the expected API call for the sanitized (but invalid) input
            // Assume the API returns a 404 for such a path
            const mockRawResponse = {
                status: 404,
                data: { error: 'Not Found' },
                headers: {},
                config: {},
                statusText: 'Not Found'
            };
            mockAxiosInstance.get.mockResolvedValue(mockRawResponse); // Mock the response for '/-'

            const response = await e164.lookup(testInput);

            // Now expect the call to have happened
            expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith(expectedUrl, expect.any(Object));

            // Assert the response reflects the API error
            expect(response).toBeInstanceOf(Response);
            expect(response.isSuccess()).toBe(false);
            expect(response.statusCode).toBe(404); // Status code from the mocked API response
            expect(response.error).toMatch(/Not Found|Request failed with status code 404/); // Error from the mocked API response
            expect(response.data).toBeNull();
            expect(response.rawResponse).toBe(mockRawResponse);
        });

        it('should return a failure Response for empty phone number input', async () => {
            const response = await e164.lookup('');
            // For empty input, the check `if (!sanitizedNumber)` should trigger *before* the API call
            expect(mockAxiosInstance.get).not.toHaveBeenCalled();
            expect(response.isSuccess()).toBe(false);
            expect(response.statusCode).toBe(400);
            expect(response.error).toBe('Invalid phone number format provided.');
        });
    });

});
