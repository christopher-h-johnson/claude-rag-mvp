# Streaming Content Debug Guide

## Issue
The `.message-content` div is not showing streamed messages.

## Debug Steps Added

### 1. Enhanced Logging in Chat.tsx

Added detailed logging in `handleChatResponse`:
```typescript
console.log('Chat response payload:', {
    messageId,
    hasContent: !!content,
    content: content?.substring(0, 100),
    contentLength: content?.length || 0,
    isComplete,
    hasRetrievedChunks: !!retrievedChunks,
    chunksCount: retrievedChunks?.length || 0
});

console.log('Setting streaming content:', content.substring(0, 50));
```

### 2. Added Logging in ChatWindow.tsx

```typescript
useEffect(() => {
    if (streamingContent) {
        console.log('ChatWindow received streaming content:', streamingContent.substring(0, 50));
    }
}, [streamingContent]);

// In render
console.log('Render state:', { 
    hasStreamingContent: !!streamingContent, 
    streamingLength: streamingContent?.length,
    isTyping,
    messageCount: messages.length 
});
```

## What to Check in Browser Console

### 1. Check if WebSocket Messages Are Received
Look for:
```
Received WebSocket message: {type: 'chat_response', payload: {...}}
```

### 2. Check Payload Structure
Look for:
```
Chat response payload: {
    messageId: "msg-123",
    hasContent: true,
    content: "Hello...",
    contentLength: 50,
    isComplete: false
}
```

### 3. Check if Streaming Content is Set
Look for:
```
Setting streaming content: Hello...
```

### 4. Check if ChatWindow Receives It
Look for:
```
ChatWindow received streaming content: Hello...
```

### 5. Check Render State
Look for:
```
Render state: {
    hasStreamingContent: true,
    streamingLength: 50,
    isTyping: false,
    messageCount: 2
}
```

## Common Issues and Solutions

### Issue 1: No WebSocket Messages
**Symptom**: No "Received WebSocket message" logs
**Solution**: WebSocket not connected - check backend deployment

### Issue 2: Payload Missing Content
**Symptom**: `hasContent: false` in logs
**Solution**: Backend not sending content field - check backend message format

### Issue 3: isComplete is Always True
**Symptom**: Messages go straight to completed state
**Solution**: Backend not implementing streaming - check backend streaming logic

### Issue 4: Content Not Setting State
**Symptom**: "Setting streaming content" log appears but ChatWindow doesn't receive it
**Solution**: React state update issue - check if Chat component is re-rendering

### Issue 5: Streaming Content Not Rendering
**Symptom**: ChatWindow receives content but nothing displays
**Solution**: CSS issue - check if `.message.streaming` styles are applied

## Backend Message Format Expected

### Streaming Message (isComplete: false)
```json
{
  "type": "chat_response",
  "payload": {
    "messageId": "msg-123",
    "content": "Hello, this is a streaming response...",
    "isComplete": false
  }
}
```

### Complete Message (isComplete: true)
```json
{
  "type": "chat_response",
  "payload": {
    "messageId": "msg-123",
    "content": "Hello, this is the complete response.",
    "isComplete": true,
    "retrievedChunks": [...]
  }
}
```

## Testing Streaming Locally

If backend is not ready, you can test with mock data:

```typescript
// In Chat.tsx, add a test button
const testStreaming = () => {
    setStreamingContent('This is a test streaming message that should appear in the chat window.');
};

// In render
<button onClick={testStreaming}>Test Streaming</button>
```

## CSS Verification

Check in browser DevTools that these styles are applied:

```css
.message.streaming {
    width: 90%;
    max-width: 90%;
    min-width: 300px;
    display: flex;
    flex-direction: column;
}

.message.streaming .message-content {
    white-space: pre-wrap;
    word-wrap: break-word;
    width: 100%;
}
```

## React DevTools Check

1. Open React DevTools
2. Find `Chat` component
3. Check `streamingContent` state
4. Find `ChatWindow` component
5. Check `streamingContent` prop

## Network Tab Check

1. Open Network tab
2. Filter by WS (WebSocket)
3. Click on the WebSocket connection
4. Check Messages tab
5. Look for outgoing and incoming messages

## Expected Flow

1. User sends message
2. WebSocket sends `chat_message` action
3. Backend responds with streaming messages:
   - First: `{isComplete: false, content: "Hello"}`
   - Second: `{isComplete: false, content: "Hello, how"}`
   - Third: `{isComplete: false, content: "Hello, how are you?"}`
   - Final: `{isComplete: true, content: "Hello, how are you?"}`
4. Frontend updates `streamingContent` state on each message
5. ChatWindow renders streaming div
6. On complete, message moves to messages array

## Quick Fixes to Try

### 1. Force Re-render
Add a key to ChatWindow:
```tsx
<ChatWindow
    key={streamingContent}
    streamingContent={streamingContent}
    ...
/>
```

### 2. Use Different State Update
```typescript
// Instead of
setStreamingContent(content);

// Try
setStreamingContent(prev => content);
```

### 3. Check for Empty String
```typescript
// Add check
if (content && content.trim()) {
    setStreamingContent(content);
}
```

### 4. Verify Conditional Rendering
```tsx
{/* Add explicit check */}
{streamingContent && streamingContent.length > 0 && (
    <div className="message assistant streaming">
        <div className="message-content">
            {streamingContent}
        </div>
    </div>
)}
```

## Next Steps

1. Open browser console
2. Send a test message
3. Watch the console logs
4. Identify which step is failing
5. Apply the appropriate fix from above

The logs will tell you exactly where the issue is in the data flow.
