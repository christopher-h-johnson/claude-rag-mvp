/**
 * Local script to initialize OpenSearch index
 * 
 * Usage:
 *   OPENSEARCH_ENDPOINT=your-endpoint.us-east-1.es.amazonaws.com npm run init
 * 
 * This script can be run locally to initialize the OpenSearch index
 * without deploying the Lambda function.
 */

import { initializeIndex } from '../src/index';

async function main() {
    const endpoint = process.env.OPENSEARCH_ENDPOINT;

    if (!endpoint) {
        console.error('Error: OPENSEARCH_ENDPOINT environment variable is required');
        console.error('Usage: OPENSEARCH_ENDPOINT=your-endpoint.us-east-1.es.amazonaws.com npm run init');
        process.exit(1);
    }

    console.log(`Initializing OpenSearch index at: ${endpoint}`);
    console.log('');

    try {
        const result = await initializeIndex(endpoint);
        console.log('✓ Success:', result.message);
        process.exit(0);
    } catch (error: any) {
        console.error('✗ Error:', error.message);
        process.exit(1);
    }
}

main();
