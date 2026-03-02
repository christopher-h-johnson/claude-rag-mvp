/**
 * Basic usage examples for the Query Router module
 */

import { classifyQuery, Message } from '../src';

// Example 1: Simple question about documents
console.log('Example 1: Document question');
const result1 = classifyQuery("What information is in the uploaded PDF?");
console.log(result1);
console.log('---\n');

// Example 2: Conversational greeting
console.log('Example 2: Greeting');
const result2 = classifyQuery("Hello! How are you?");
console.log(result2);
console.log('---\n');

// Example 3: Complex query
console.log('Example 3: Complex comparison query');
const result3 = classifyQuery("Compare the revenue figures in Q3 and Q4 reports");
console.log(result3);
console.log('---\n');

// Example 4: Follow-up with context
console.log('Example 4: Follow-up with context');
const context: Message[] = [
    {
        role: 'user',
        content: 'What does the document say about sales?'
    },
    {
        role: 'assistant',
        content: 'According to the document on page 5, sales increased by 15%...'
    }
];
const result4 = classifyQuery("What about Q3?", context);
console.log(result4);
console.log('---\n');

// Example 5: Thank you message
console.log('Example 5: Gratitude');
const result5 = classifyQuery("Thanks for the information!");
console.log(result5);
console.log('---\n');

// Example 6: General knowledge question
console.log('Example 6: General question');
const result6 = classifyQuery("How does photosynthesis work?");
console.log(result6);
console.log('---\n');

// Example 7: Specific document reference
console.log('Example 7: Specific page reference');
const result7 = classifyQuery("Find the information on page 12 of the technical specification");
console.log(result7);
console.log('---\n');
