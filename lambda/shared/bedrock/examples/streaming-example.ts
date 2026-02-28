/**
 * Example: Streaming Response from Claude 3 Sonnet
 * 
 * This example demonstrates how to use the BedrockService to generate
 * streaming responses from Claude 3 Sonnet.
 */

import { BedrockService } from '../src/index.js';

async function streamingExample() {
    // Initialize the Bedrock service
    const bedrock = new BedrockService({
        region: process.env.AWS_REGION || 'us-east-1',
        maxTokens: 2048,
        temperature: 0.7,
        topP: 0.9,
    });

    console.log('Sending query to Claude 3 Sonnet...\n');

    try {
        // Generate streaming response
        for await (const chunk of bedrock.generateResponse({
            prompt: 'Explain what RAG (Retrieval-Augmented Generation) is in 2-3 sentences.',
            systemPrompt: 'You are a helpful AI assistant that provides clear, concise explanations.',
        })) {
            if (!chunk.isComplete) {
                // Print each token as it arrives
                process.stdout.write(chunk.text);
            } else {
                // Print final statistics
                console.log(`\n\nGeneration complete!`);
                if (chunk.tokenCount) {
                    console.log(`Total tokens used: ${chunk.tokenCount}`);
                }
            }
        }
    } catch (error) {
        console.error('Error generating response:', error);
    }
}

// Run the example
streamingExample();
