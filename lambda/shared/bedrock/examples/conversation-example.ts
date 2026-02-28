/**
 * Example: Multi-Turn Conversation with Claude 3 Sonnet
 * 
 * This example demonstrates how to maintain conversation context
 * across multiple turns using conversation history with sliding window.
 */

import { BedrockService, formatConversationContext } from '../src/index.js';
import type { ConversationMessage } from '../src/index.js';

async function conversationExample() {
    // Initialize the Bedrock service
    const bedrock = new BedrockService({
        region: process.env.AWS_REGION || 'us-east-1',
    });

    // Maintain conversation history
    const conversationHistory: ConversationMessage[] = [];

    console.log('Starting multi-turn conversation...\n');

    try {
        // First turn
        console.log('User: What is the capital of France?');
        const response1 = await bedrock.generateResponseSync({
            prompt: 'What is the capital of France?',
            conversationHistory,
        });
        console.log(`Assistant: ${response1}\n`);

        // Add to history
        conversationHistory.push(
            { role: 'user', content: 'What is the capital of France?' },
            { role: 'assistant', content: response1 }
        );

        // Second turn - Claude should understand "it" refers to Paris
        console.log('User: What is the population of it?');
        const response2 = await bedrock.generateResponseSync({
            prompt: 'What is the population of it?',
            // Use formatConversationContext to apply sliding window (last 10 messages)
            conversationHistory: formatConversationContext(conversationHistory),
        });
        console.log(`Assistant: ${response2}\n`);

        // Add to history
        conversationHistory.push(
            { role: 'user', content: 'What is the population of it?' },
            { role: 'assistant', content: response2 }
        );

        // Third turn - Claude maintains context
        console.log('User: What are some famous landmarks there?');
        const response3 = await bedrock.generateResponseSync({
            prompt: 'What are some famous landmarks there?',
            // Apply sliding window to limit context size
            conversationHistory: formatConversationContext(conversationHistory),
        });
        console.log(`Assistant: ${response3}\n`);

        console.log(`Conversation complete! Total turns: ${conversationHistory.length / 2}`);
        console.log(`Context window applied: last ${Math.min(10, conversationHistory.length)} messages`);
    } catch (error) {
        console.error('Error in conversation:', error);
    }
}

// Run the example
conversationExample();
