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
        e164 = new E164(); // Initialize with default settings
    });

    describe('Constructor', () => {
        it('should create an axios instance with default headers if no client is provided', () => {
            expect(axios.create).toHaveBeenCalledTimes(1);
            expect(axios.create).toHaveBeenCalledWith({
                baseURL: 'https://e164.com/',
                headers: {
                    'User-Agent': 'e164-node-sdk/1.0 (Node.js)',
                    'Referer': 'https://www.e164.com/',
                },
            });
        });

        it('should use the provided client instance', () => {
            const customClient = { get: jest.fn() };
            const e164WithClient = new E164({ client: customClient });
            expect(axios.create).not.toHaveBeenCalled();
            expect(e164WithClient.client).toBe(customClient);
        });

        it('should include Authorization header if apiKey is provided', () => {
            const apiKey = 'test-api-key';
            new E164({ apiKey: apiKey });
            expect(axios.create).toHaveBeenCalledWith({
                baseURL: 'https://e164.com/',
                headers: {
                    'User-Agent': 'e164-node-sdk/1.0 (Node.js)',
                    'Referer': 'https://www.e164.com/',
                    'Authorization': `Bearer ${apiKey}`,
                },
            });
        });
    });

    describe('lookup', () => {
        const testNumber = '+14155552671';
        const sanitizedNumber = '14155552671'; // Assuming '+' is stripped by encodeURIComponent or API handles it
        const testUrl = `/${encodeURIComponent(sanitizedNumber)}`;

        it('should successfully lookup a phone number and return a Response object', async () => {
            const mockData = { prefix: '1415', location: 'San Francisco' };
            const mockRawResponse = {
                status: 200,
                data: mockData,
                headers: {},
                config: {},
                statusText: 'OK'
            };
            mockAxiosInstance.get.mockResolvedValue(mockRawResponse);

            const response = await e164.lookup(testNumber);

            expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/${encodeURIComponent('+14155552671')}`, expect.any(Object)); // Check sanitized URL
            expect(response).toBeInstanceOf(Response);
            expect(response.isSuccess()).toBe(true);
            expect(response.statusCode).toBe(200);
            expect(response.data).toEqual(mockData);
            expect(response.prefix).toBe(mockData.prefix);
            expect(response.location).toBe(mockData.location);
            expect(response.error).toBeNull();
            expect(response.rawResponse).toBe(mockRawResponse);
        });

        it('should handle API response with an array (taking the first element)', async () => {
            const mockData = [{ prefix: '1415', location: 'San Francisco' }];
             const mockRawResponse = {
                status: 200,
                data: mockData,
                headers: {},
                config: {},
                statusText: 'OK'
            };
            mockAxiosInstance.get.mockResolvedValue(mockRawResponse);

            const response = await e164.lookup(testNumber);

            expect(response.isSuccess()).toBe(true);
            expect(response.statusCode).toBe(200);
            expect(response.data).toEqual(mockData[0]); // Should contain the first element
            expect(response.prefix).toBe(mockData[0].prefix);
            expect(response.error).toBeNull();
        });


        it('should return a failure Response for invalid phone number format input', async () => {
            const response = await e164.lookup('invalid-number'); // Contains non-digit/non-+/- chars

            expect(mockAxiosInstance.get).not.toHaveBeenCalled();
            expect(response).toBeInstanceOf(Response);
            expect(response.isSuccess()).toBe(false);
            expect(response.statusCode).toBe(400);
            expect(response.error).toBe('Invalid phone number format provided.');
            expect(response.data).toBeNull();
        });

         it('should return a failure Response for empty phone number input', async () => {
            const response = await e164.lookup('');

            expect(mockAxiosInstance.get).not.toHaveBeenCalled();
            expect(response).toBeInstanceOf(Response);
            expect(response.isSuccess()).toBe(false);
            expect(response.statusCode).toBe(400);
            expect(response.error).toBe('Invalid phone number format provided.');
            expect(response.data).toBeNull();
        });

        it('should handle 404 Not Found response from API', async () => {
            const mockRawResponse = {
                status: 404,
                data: { error: 'Not Found' }, // Example error structure
                headers: {},
                config: {},
                statusText: 'Not Found'
            };
            mockAxiosInstance.get.mockResolvedValue(mockRawResponse); // Use resolvedValue because validateStatus allows 4xx

            const response = await e164.lookup(testNumber);

            expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
            expect(response).toBeInstanceOf(Response);
            expect(response.isSuccess()).toBe(false);
            expect(response.statusCode).toBe(404);
            expect(response.error).toBe('Not Found'); // Or the default message if API doesn't provide one
            expect(response.data).toBeNull();
        });

        it('should handle other non-2xx error responses from API', async () => {
            const mockRawResponse = {
                status: 403,
                data: { message: 'Forbidden' },
                headers: {},
                config: {},
                statusText: 'Forbidden'
            };
             mockAxiosInstance.get.mockResolvedValue(mockRawResponse);

            const response = await e164.lookup(testNumber);

            expect(response.isSuccess()).toBe(false);
            expect(response.statusCode).toBe(403);
            // Assuming the error message comes from data.message or data.error
            expect(response.error).toBe('Request failed with status code 403'); // Adjust if API provides error field
            expect(response.data).toBeNull();
        });

        it('should handle network errors or exceptions during request', async () => {
            const networkError = new Error('Network Error');
            mockAxiosInstance.get.mockRejectedValue(networkError);

            const response = await e164.lookup(testNumber);

            expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
            expect(response).toBeInstanceOf(Response);
            expect(response.isSuccess()).toBe(false);
            expect(response.statusCode).toBe(500); // Default status for network errors
            expect(response.error).toBe('Network Error');
            expect(response.data).toBeNull();
        });

         it('should handle axios error with response object', async () => {
            const axiosError = new Error('Request failed with status code 500');
            axiosError.response = {
                status: 500,
                data: { error: 'Server Error' },
                headers: {},
                config: {},
                statusText: 'Internal Server Error'
            };
            mockAxiosInstance.get.mockRejectedValue(axiosError); // Simulate axios throwing an error with a response

            const response = await e164.lookup(testNumber);

            expect(response.isSuccess()).toBe(false);
            expect(response.statusCode).toBe(500);
            expect(response.error).toBe('Request failed with status code 500'); // Uses error.message
            expect(response.data).toBeNull();
            expect(response.rawResponse).toBe(axiosError.response);
        });

        it('should handle API response with empty data array', async () => {
            const mockRawResponse = {
                status: 200,
                data: [], // Empty array
                headers: {},
                config: {},
                statusText: 'OK'
            };
            mockAxiosInstance.get.mockResolvedValue(mockRawResponse);

            const response = await e164.lookup(testNumber);

            expect(response.isSuccess()).toBe(false); // Treat empty array as not found/invalid
            expect(response.statusCode).toBe(404);
            expect(response.error).toBe('Phone number not found or invalid.');
            expect(response.data).toBeNull();
        });

         it('should handle API response with non-object, non-array data', async () => {
            const mockRawResponse = {
                status: 200,
                data: "unexpected string", // Invalid data format
                headers: {},
                config: {},
                statusText: 'OK'
            };
            mockAxiosInstance.get.mockResolvedValue(mockRawResponse);

            const response = await e164.lookup(testNumber);

            expect(response.isSuccess()).toBe(false);
            expect(response.statusCode).toBe(500); // Internal error due to format mismatch
            expect(response.error).toBe('Received unexpected data format from API.');
            expect(response.data).toBeNull(); // data property on Response should be null
        });
    });
});
