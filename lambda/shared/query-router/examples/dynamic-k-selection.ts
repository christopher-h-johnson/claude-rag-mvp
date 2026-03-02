/**
 * Dynamic K Selection Examples
 * 
 * This example demonstrates how the query router determines the optimal
 * number of document chunks (k) to retrieve based on query complexity.
 * 
 * Rules:
 * - k=0: No retrieval needed (conversational queries)
 * - k=5: Simple retrieval queries (default)
 * - k=10: Complex retrieval queries
 */

import { classifyQuery } from '../src/classifier';

console.log('=== Dynamic K Selection Examples ===\n');

// Example 1: Conversational queries (k=0)
console.log('1. Conversational Queries (k=0):');
const conversationalQueries = [
    'Hello',
    'Thank you',
    'How are you?',
];

for (const query of conversationalQueries) {
    const result = classifyQuery(query);
    console.log(`   "${query}"`);
    console.log(`   → k=${result.suggestedK}, retrieval=${result.requiresRetrieval}`);
    console.log(`   → ${result.reasoning}\n`);
}

// Example 2: Simple retrieval queries (k=5)
console.log('\n2. Simple Retrieval Queries (k=5):');
const simpleQueries = [
    'What is the policy?',
    'Show me the document',
    'Who is the author?',
];

for (const query of simpleQueries) {
    const result = classifyQuery(query);
    console.log(`   "${query}"`);
    console.log(`   → k=${result.suggestedK}, retrieval=${result.requiresRetrieval}`);
    console.log(`   → ${result.reasoning}\n`);
}

// Example 3: Complex retrieval queries (k=10)
console.log('\n3. Complex Retrieval Queries (k=10):');
const complexQueries = [
    'Compare the two policies and show me the differences',
    'Give me a comprehensive overview of all the documents',
    'Find all references to topic A and topic B in the files',
    'What is the policy? How does it compare to the old one?',
];

for (const query of complexQueries) {
    const result = classifyQuery(query);
    console.log(`   "${query}"`);
    console.log(`   → k=${result.suggestedK}, retrieval=${result.requiresRetrieval}`);
    console.log(`   → ${result.reasoning}\n`);
}

// Example 4: Complexity factors
console.log('\n4. Complexity Factors:');
console.log('   The following factors increase complexity score:');
console.log('   - Comparison keywords (compare, contrast, difference)');
console.log('   - Comprehensive requests (all, every, complete)');
console.log('   - Multiple document keywords (2+)');
console.log('   - Long queries (>15 words)');
console.log('   - Multiple questions (2+ question marks)');
console.log('   - Broad patterns (overview, summary, list all)');
console.log('   - Multiple conjunctions (and...and, or...or)');
console.log('\n   Complexity score >= 2 → k=10');
console.log('   Complexity score < 2 → k=5');
