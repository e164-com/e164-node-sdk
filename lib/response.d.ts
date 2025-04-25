import { AxiosResponse } from 'axios'; // Assuming axios is used, adjust if needed

/**
 * Represents the data payload structure for a successful lookup.
 */
export interface E164LookupData {
    prefix: string | null;
    calling_code: string | null;
    iso3: string | null;
    tadig: string | null;
    mccmnc: string | null;
    type: string | null;
    location: string | null;
    operator_brand: string | null;
    operator_company: string | null;
    total_length_min: string | null;
    total_length_max: string | null;
    weight: string | null;
    source: string | null;
    [key: string]: any; // Allow for other potential properties
}

/**
 * Represents a standardized response from the E164 API, potentially including number details.
 */
declare class Response {
    /** The HTTP status code of the response. */
    statusCode: number;
    /** An error message, if the request failed. */
    error: string | null;
    /** The original raw response object from the HTTP client (e.g., AxiosResponse). */
    rawResponse: AxiosResponse | any | null; // Use 'any' or a specific type if not Axios
    /** The data payload of the response, if successful. */
    data: E164LookupData | null;

    // Properties assigned from data if successful
    prefix: string | null;
    calling_code: string | null;
    iso3: string | null;
    tadig: string | null;
    mccmnc: string | null;
    type: string | null;
    location: string | null;
    operator_brand: string | null;
    operator_company: string | null;
    total_length_min: string | null;
    total_length_max: string | null;
    weight: string | null;
    source: string | null;

    /**
     * Creates an instance of Response.
     * @param statusCode - The HTTP status code of the response.
     * @param data - The data payload of the response, if successful.
     * @param error - An error message, if the request failed.
     * @param rawResponse - The original raw response object from the HTTP client.
     */
    constructor(statusCode: number, data: E164LookupData | null, error: string | null, rawResponse: AxiosResponse | any | null);

    /**
     * Checks if the response indicates success (typically status code 2xx).
     * @returns True if the status code is between 200 and 299, false otherwise.
     */
    isSuccess(): boolean;
}

export = Response;
