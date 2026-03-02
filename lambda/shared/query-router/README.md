# Query Router Module

Heuristic-based query classification module that determines whether a user query requires RAG (Retrieval-Augmented Generation) retrieval or can be answered directly by the LLM.

## Features

- **Question Pattern Detection**: Identifies queries with question words (who, what, where, when, why, how)
- **Document Keyword Detection**: Recognizes document-related terms (document, file, PDF, page)
- **Conversational Pattern Detection**: Identifies greetings, thanks, and casual conversation
- **Complexity Analysis**: Determines query complexity to suggest optimal retrieval count (k)
- **Context Awareness**: Uses conversation history for better classification
- **Confidence Scoring**: Returns confidence level (0.0-1.0) for each classification

## Installation

```bash
npm install
npm run build
```

## Usage

```typescript
import { classifyQuery, QueryClassification, Message } from '@chatbot/query-router';

// Simple classification
const result = classifyQuery("What information is in the uploaded document?");
console.log(result);
// {
//   requiresRetrieval: true,
//   confidence: 0.95,
//   reasoning: "2 document keyword(s) found, question pattern detected",
//   suggestedK: 10
// }

// With conversation context
const context: Message[] = [
  { role: 'user', content: 'Tell me about the Q4 report' },
  { role: 'assistant', content: 'According to the document...' }
];

const followUp = classifyQuery("What about Q3?", context);
console.log(followUp);
// {
//   requiresRetrieval: true,
//   confidence: 0.75,
//   reasoning: "question pattern detected, follow-up to document-related conversation",
//   suggestedK: 5
// }
```

## Classification Logic

### Requires Retrieval (RAG)

Queries that match these patterns will be classified as requiring retrieval:

- **Question patterns**: "What is...", "How does...", "Where can I find..."
- **Document keywords**: "in the document", "from the PDF", "on page 5"
- **Search intent**: "find", "search", "look up", "show me"
- **Complex queries**: Multiple conjunctions, comparison requests

### Direct LLM Response

Queries that match these patterns will be classified as NOT requiring retrieval:

- **Greetings**: "Hello", "Hi there", "Good morning"
- **Thanks**: "Thank you", "Thanks", "I appreciate it"
- **Acknowledgments**: "OK", "Got it", "I understand"
- **Meta questions**: "Who are you?", "What can you do?"
- **Simple follow-ups**: "Yes", "No", "Maybe"

## Confidence Levels

- **0.95**: Strong indicators (multiple document keywords, clear conversational pattern)
- **0.90**: Document keyword + question pattern
- **0.75**: Question pattern with reasonable length
- **0.70**: Some indicators present
- **0.60**: No clear indicators (ambiguous)

## Suggested K Values

The module dynamically determines the optimal number of document chunks (k) to retrieve based on query complexity:

- **k=0**: No retrieval needed (conversational queries)
- **k=5**: Standard retrieval (simple questions, default)
- **k=10**: Complex retrieval (comparison queries, comprehensive requests)

### Complexity Factors

The following factors increase the complexity score and may result in k=10:

1. **Comparison keywords**: compare, contrast, difference, similar, relationship
2. **Comprehensive requests**: all, every, entire, complete, comprehensive
3. **Multiple document keywords**: 2+ document-related terms in the query
4. **Long queries**: More than 15 words
5. **Multiple questions**: 2+ question marks in the query
6. **Broad patterns**: overview, summary, list all, show all
7. **Multiple conjunctions**: Multiple "and" or "or" conjunctions

**Threshold**: Complexity score >= 2 → k=10, otherwise k=5

### Examples

```typescript
// k=5 (simple queries)
classifyQuery("What is the policy?")
// → { suggestedK: 5, requiresRetrieval: true }

classifyQuery("Show me the document")
// → { suggestedK: 5, requiresRetrieval: true }

// k=10 (complex queries)
classifyQuery("Compare the two policies and show differences")
// → { suggestedK: 10, requiresRetrieval: true }

classifyQuery("Give me a comprehensive overview of all documents")
// → { suggestedK: 10, requiresRetrieval: true }

classifyQuery("What is policy A? How does it differ from policy B?")
// → { suggestedK: 10, requiresRetrieval: true }

// k=0 (no retrieval)
classifyQuery("Hello")
// → { suggestedK: 0, requiresRetrieval: false }
```

## Integration with Chat Handler

```typescript
import { classifyQuery } from '@chatbot/query-router';

async function handleChatMessage(query: string, history: Message[]) {
  // Classify the query
  const classification = classifyQuery(query, history);
  
  if (classification.requiresRetrieval) {
    // Use RAG pipeline
    const context = await retrieveContext(query, classification.suggestedK);
    const response = await generateResponseWithContext(query, context, history);
    return response;
  } else {
    // Direct LLM response
    const response = await generateResponse(query, history);
    return response;
  }
}
```

## Testing

The module uses heuristic rules that can be tested with various query types:

```typescript
// Test cases
const testQueries = [
  "Hello!",                                    // Conversational
  "What is in the document?",                  // Retrieval needed
  "Thanks for your help",                      // Conversational
  "Compare the Q3 and Q4 reports",            // Complex retrieval
  "Who are you?",                              // Conversational
  "Find information about revenue on page 5"   // Retrieval needed
];

testQueries.forEach(query => {
  const result = classifyQuery(query);
  console.log(`Query: "${query}"`);
  console.log(`Retrieval: ${result.requiresRetrieval}, Confidence: ${result.confidence}`);
  console.log(`Reasoning: ${result.reasoning}\n`);
});
```

## Requirements Satisfied

- **Requirement 7.5**: Query classification to determine RAG vs direct LLM routing
- Heuristic-based classification with confidence scoring
- Support for question patterns, document keywords, and conversational patterns
- Dynamic k selection based on query complexity
