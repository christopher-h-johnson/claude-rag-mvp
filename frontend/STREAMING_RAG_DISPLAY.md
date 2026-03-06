# Streaming RAG Citations Display

## Overview
The chat window now displays RAG citations in real-time as streaming responses arrive. Users can see the source documents that informed the AI's response while the response is still being generated.

## Implementation

### 1. Data Flow

#### Chat Component (Chat.tsx)
- Stores RAG chunks in `currentRAGChunksRef` when they arrive
- Passes chunks to ChatWindow via `streamingRAGChunks` prop
- Chunks persist throughout the streaming session
- Cleared when message is complete

```typescript
// Store RAG chunks when they arrive
if (retrievedChunks && retrievedChunks.length > 0) {
    currentRAGChunksRef.current = retrievedChunks;
}

// Pass to ChatWindow
<ChatWindow
    messages={messages}
    isTyping={isTyping}
    streamingContent={streamingContent}
    streamingRAGChunks={currentRAGChunksRef.current}
    className="chat-window-flex"
/>
```

#### ChatWindow Component (ChatWindow.tsx)
- Receives `streamingRAGChunks` prop
- Renders citations below streaming content
- Uses same citation format as completed messages

```typescript
{streamingContent && (
    <div className="message assistant streaming">
        <div className="message-content">
            {streamingContent}
        </div>
        {streamingRAGChunks && streamingRAGChunks.length > 0 && (
            <div className="message-footer">
                {renderStreamingCitations(streamingRAGChunks)}
            </div>
        )}
    </div>
)}
```

### 2. Citation Rendering

The `renderStreamingCitations` function displays:
- Document name
- Page number
- Relevance score (percentage)
- Text excerpt

```typescript
const renderStreamingCitations = (chunks: DocumentChunk[]) => {
    return (
        <div className="streaming-citations">
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

### 3. Styling

Citations are styled to match the streaming message:
- Light gray background (#f8f9fa)
- Blue left border (3px solid #007bff)
- White citation cards
- Green relevance score badges
- Consistent with completed message citations

## User Experience

### Scenario 1: RAG Context Arrives First

1. User sends message: "What file formats are supported?"
2. Backend sends RAG chunks (no content yet):
   ```
   ┌─────────────────────────────────────┐
   │ Assistant                           │
   │ [Typing indicator shown]            │
   └─────────────────────────────────────┘
   ```

3. Streaming content starts arriving:
   ```
   ┌─────────────────────────────────────┐
   │ Assistant                           │
   │                                     │
   │ Based on the documentation▋         │
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

4. Content continues streaming:
   ```
   ┌─────────────────────────────────────┐
   │ Assistant                           │
   │                                     │
   │ Based on the documentation, the     │
   │ system supports PDF, DOCX, and      │
   │ TXT formats for document upload▋    │
   │                                     │
   │ 📄 Sources (3)                      │
   │ [Citations remain visible]          │
   └─────────────────────────────────────┘
   ```

5. Message completes - citations persist in message history

### Scenario 2: RAG Chunks with Content

1. Backend sends RAG chunks with first content chunk
2. Citations appear immediately with streaming content
3. Content accumulates while citations remain visible
4. Final message includes citations in metadata

## Benefits

1. **Immediate Context**: Users see sources before response completes
2. **Transparency**: Clear indication of what documents informed the response
3. **Trust Building**: Real-time citation display builds confidence
4. **Verification**: Users can read sources while response streams
5. **Consistency**: Same citation format for streaming and completed messages

## Technical Details

### Props Interface
```typescript
interface ChatWindowProps {
    messages: ChatMessage[];
    isTyping: boolean;
    streamingContent?: string;
    streamingRAGChunks?: DocumentChunk[];  // New prop
    className?: string;
}
```

### State Management
- RAG chunks stored in ref (not state) to avoid re-renders
- Ref persists across streaming chunks
- Cleared when message completes
- Included in final message metadata

### Performance
- No additional re-renders (using ref)
- Citations render once when chunks arrive
- Efficient updates during streaming
- Smooth scrolling maintained

## Debug Logging

Console logs show:
```javascript
ChatWindow render state: {
    hasStreamingContent: true,
    streamingLength: 156,
    hasStreamingRAGChunks: true,
    ragChunksCount: 3,
    isTyping: false,
    messageCount: 5
}
```

## Future Enhancements

Potential improvements:
- Highlight citation numbers in streaming text (e.g., [1], [2])
- Animate citation appearance
- Collapsible citations during streaming
- Citation preview on hover
- Link citations to full document view
