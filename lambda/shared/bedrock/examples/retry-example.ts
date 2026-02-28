/**
 * Example: Retry Logic with Exponential Backoff
 * 
 * Demonstrates how the Bedrock service automatically retries on throttling errors
 * with exponential backoff (1s, 2s, 4s delays).
 */

import { BedrockService } from '../src/index.js';

async function main() {
    const bedrock = new BedrockService({
        region: 'us-east-1',
    });

    console.log('Example 1: Automatic retry on throttling errors');
    console.log('================================================\n');

    try {
        // The BedrockService will automatically retry if it encounters throttling errors
        // Retry attempts: 3 maximum
        // Delays: 1s, 2s, 4s (exponential backoff)
        const response = await bedrock.generateResponseSync({
            prompt: 'What is the capital of France?',
            maxTokens: 100,
        });

        console.log('Response:', response);
    } catch (error: any) {
        console.error('Error after retries:', error.message);
        // If all 3 attempts fail, the error is thrown
    }

    console.log('\n\nExample 2: Streaming with automatic retry');
    console.log('==========================================\n');

    try {
        // Streaming responses also have retry logic
        // If the stream fails due to throttling, it will retry from the beginning
        for await (const chunk of bedrock.generateResponse({
            prompt: 'Tell me a short joke.',
            maxTokens: 100,
        })) {
            if (chunk.text) {
                process.stdout.write(chunk.text);
            }
            if (chunk.isComplete) {
                console.log('\n\nStream complete!');
                console.log('Token count:', chunk.tokenCount);
            }
        }
    } catch (error: any) {
        console.error('Error after retries:', error.message);
    }

    console.log('\n\nRetry behavior:');
    console.log('- Automatically retries on ThrottlingException');
    console.log('- Automatically retries on HTTP 429 (Too Many Requests)');
    console.log('- Automatically retries on HTTP 503 (Service Unavailable)');
    console.log('- Exponential backoff: 1s, 2s, 4s');
    console.log('- Maximum 3 attempts');
    console.log('- Logs all retry attempts to CloudWatch');
}

main().catch(console.error);
