# RAG Citations Display Guide

## Overview
The chat interface now displays document citations (RAG chunks) for assistant responses that use retrieved context. Users can view the source documents and specific text passages that informed the AI's response.

## Features

### 1. Citation Storage
- RAG chunks are stored in `currentRAGChunksRef` when they arrive from the backend
- Chunks can arrive before content (RAG context message) or with streaming content
- Stored chunks are included in the final message metadata when `isComplete: true`

### 2. Citation Display
- Citations appear below assistant messages that have retrieved chunks
- Collapsed by default with a "View Sources (N)" toggle button
- Expandable to show full citation details

### 3. Citation Information
Each citation displays:
- **Citation Number**: Sequential number [1], [2], etc.
- **Document Name**: Name of the source document
- **Page Number**: Specific page in the document
- **Relevance Score**: Percentage showing how relevant the chunk is (0-100%)
- **Text Excerpt**: The actual text passage from the document

## UI Components

### Message Component
Located in `frontend/src/components/Message.tsx`

```typescript
// Checks if message has citations
const hasCitations = message.metadata?.retrievedChunks && 
                     message.metadata.retrievedChunks.length > 0;

// Renders citations when expanded
{hasCitations && (
    <div className="message-footer">
        <button onClick={() => setShowCitations(!showCitations)}>
            View Sources ({message.metadata!.retrievedChunks!.length})
        </button>
        {showCitations && renderCitations(message.metadata!.retrievedChunks!)}
    </div>
)}
```

### Citation Rendering
```typescript
const renderCitations = (chunks: DocumentChunk[]) => {
    return (
        <div className="citations">
            <div className="citations-header">
                <span className="citations-icon">📄</span>
                <span className="citations-title">Sources ({chunks.length})</span>
            </div>
            <div className="citations-list">
                {chunks.map((chunk, index) => (
                    <div key={chunk.chunkId || index} className="citation-item">
                        <div className="citation-header">
                            <span className="citation-number">[{index + 1}]</span>
                            <span className="citation-document">{chunk.documentName}</span>
                            <span className="citation-page">Page {chunk.pageNumber}</span>
                            <span className="citation-score">
                                {(chunk.score * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="citation-text">{chunk.text}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
```

## Data Flow

### 1. RAG Context Arrives (Optional)
```json
{
  "type": "chat_response",
  "payload": {
    "messageId": "msg-123",
    "retrievedChunks": [
      {
        "chunkId": "chunk-1",
        "documentId": "doc-1",
        "documentName": "User Guide.pdf",
        "pageNumber": 5,
        "text": "The system supports...",
        "score": 0.92,
        "metadata": {}
      }
    ],
    "isComplete": false
  }
}
```
- Chunks stored in `currentRAGChunksRef.current`
- Typing indicator shown

### 2. Streaming Content Arrives
```json
{
  "type": "chat_response",
  "payload": {
    "messageId": "msg-123",
    "content": "Based on the documentation...",
    "isComplete": false
  }
}
```
- Content accumulated in `streamingContent`
- RAG chunks remain in ref

### 3. Complete Message
```json
{
  "type": "chat_response",
  "payload": {
    "messageId": "msg-123",
    "content": "Based on the documentation, the system supports...",
    "isComplete": true
  }
}
```
- Message added to history with RAG chunks from ref
- Streaming state cleared
- Citations available for display

## Type Definitions

### DocumentChunk
```typescript
export interface DocumentChunk {
    chunkId: string;           // Unique chunk identifier
    documentId: string;        // Source document ID
    documentName: string;      // Display name of document
    pageNumber: number;        // Page number in document
    text: string;              // Text excerpt
    score: number;             // Relevance score (0-1)
    metadata?: Record<string, any>; // Additional metadata
}
```

### ChatMessage with Citations
```typescript
export interface ChatMessage {
    messageId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    metadata?: {
        retrievedChunks?: DocumentChunk[];
        cached?: boolean;
    };
}
```

## Styling

### Citation Container
- Light gray background (#f8f9fa)
- Blue left border (3px solid #007bff)
- Rounded corners (8px)
- Padding for readability

### Citation Items
- White background
- Gray border (#e0e0e0)
- Individual cards for each source
- Hover effects for interactivity

### Relevance Score
- Green badge (#28a745)
- Light green background (#d4edda)
- Percentage format (0-100%)
- Tooltip showing "Relevance score"

## User Experience

### Collapsed State
```
┌─────────────────────────────────────┐
│ Assistant                  10:30 AM │
│                                     │
│ Based on the documentation, the     │
│ system supports multiple formats... │
│                                     │
│ ▶ View Sources (3)                  │
└─────────────────────────────────────┘
```

### Expanded State
```
┌─────────────────────────────────────┐
│ Assistant                  10:30 AM │
│                                     │
│ Based on the documentation, the     │
│ system supports multiple formats... │
│                                     │
│ ▼ View Sources (3)                  │
│                                     │
│ 📄 Sources (3)                      │
│ ┌─────────────────────────────────┐ │
│ │ [1] User Guide.pdf  Page 5  92% │ │
│ │ The system supports PDF, DOCX...│ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [2] FAQ.pdf  Page 12  87%       │ │
│ │ Common file formats include...  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [3] Technical Spec.pdf  Page 3  │ │
│ │ 85%                             │ │
│ │ Format support is provided by...│ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Benefits

1. **Transparency**: Users can see exactly what documents informed the response
2. **Verification**: Users can verify the AI's interpretation against source text
3. **Trust**: Citations build confidence in the AI's responses
4. **Navigation**: Users can identify which documents to read for more information
5. **Relevance**: Score indicates how well each source matches the query

## Future Enhancements

Potential improvements:
- Click citation to highlight in original document
- Filter citations by relevance score
- Group citations by document
- Show citation inline with response text (e.g., [1], [2])
- Download or view full source document
- Copy citation text to clipboard
