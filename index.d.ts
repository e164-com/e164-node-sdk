import Response = require('./lib/response');
import { AxiosInstance } from 'axios'; // Assuming axios is used

/**
 * Configuration options for the E164 SDK constructor.
 */
export interface E164Options {
    /** An optional pre-configured axios instance. */
    client?: AxiosInstance;
}

/**
 * E164 Node SDK Client.
 */
declare class E164 {
    /** The configured HTTP client instance. */
    readonly client: AxiosInstance;

    /**
     * Creates an instance of the E164 SDK.
     * @param options - Configuration options.
     */
    constructor(options?: E164Options);

    /**
     * Performs a lookup for a given phone number.
     * @param phoneNumber - The phone number to look up.
     * @returns A promise that resolves with a Response object.
     */
    lookup(phoneNumber: string): Promise<Response>;
}

export = E164;
