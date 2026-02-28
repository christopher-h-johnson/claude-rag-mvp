/**
 * Example: Non-Streaming Response from Claude 3 Sonnet
 * 
 * This example demonstrates how to use the BedrockService to generate
 * complete responses from Claude 3 Sonnet without streaming.
 */

import { BedrockService } from '../src/index.js';

async function nonStreamingExample() {
    // Initialize the Bedrock service
    const bedrock = new BedrockService({
        region: process.env.AWS_REGION || 'us-east-1',
    });

    console.log('Sending query to Claude 3 Sonnet...\n');

    try {
        // Generate complete response
        const response = await bedrock.generateResponseSync({
            prompt: 'What are the key benefits of serverless architecture?',
            systemPrompt: 'You are a helpful AI assistant specializing in cloud architecture.',
            maxTokens: 500,
        });

        console.log('Response:');
        console.log(response);
    } catch (error) {
        console.error('Error generating response:', error);
    }
}

// Run the example
nonStreamingExample();
