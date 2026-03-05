# Streaming Content Accumulation Fix

## Problem
The `currentMessageId` state was not being persisted properly between streaming chunks, causing content to be overwritten instead of accumulated. The console always reported "New message or first chunk - replacing content" even for subsequent chunks.

## Root Cause
React state updates are asynchronous and batched. When using `useState` for `currentMessageId`:
1. First chunk arrives, sets `currentMessageId` via `setCurrentMessageId("abc")`
2. Second chunk arrives immediately (before React re-renders)
3. The `currentMessageId` variable still has the OLD value (null) due to closure
4. Comparison fails: `"abc" === null` → false
5. Content gets replaced instead of accumulated

This is a classic React closure problem with fast-arriving async events.

## Solution
Changed from `useState` to `useRef` for tracking the current message ID. Refs are:
- Synchronous (updated immediately)
- Persistent across renders
- Don't cause re-renders when updated
- Perfect for tracking values in async callbacks

## Code Changes

### Before Fix (useState)
```typescript
const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

// In handleChatResponse:
if (messageId && messageId === currentMessageId) {
    // This check always fails because currentMessageId hasn't updated yet
    setStreamingContent(prev => prev + content);
} else {
    setStreamingContent(content);
    setCurrentMessageId(messageId || null); // Async - not available for next chunk
}
```

### After Fix (useRef)
```typescript
const currentMessageIdRef = useRef<string | null>(null);

// In handleChatResponse:
if (messageId && messageId === currentMessageIdRef.current) {
    // This check works because ref.current is updated synchronously
    setStreamingContent(prev => prev + content);
} else {
    setStreamingContent(content);
    currentMessageIdRef.current = messageId || null; // Immediate - available for next chunk
}
```

## Expected Behavior

### Chunk 1 (First chunk)
- `isComplete: false`
- `messageId: "abc"`
- `currentMessageIdRef.current: null`
- Comparison: `"abc" === null` → false
- Action: Replace content, set `currentMessageIdRef.current = "abc"` (immediate)
- Console: "New message or first chunk - replacing content"
- Result: `streamingContent = "Hello"`

### Chunk 2 (Continuation)
- `isComplete: false`
- `messageId: "abc"`
- `currentMessageIdRef.current: "abc"` (already updated from chunk 1)
- Comparison: `"abc" === "abc"` → true ✓
- Action: Accumulate content
- Console: "Accumulating content for same message"
- Result: `streamingContent = "Hello world"`

### Chunk 3 (More content)
- `isComplete: false`
- `messageId: "abc"`
- `currentMessageIdRef.current: "abc"`
- Comparison: `"abc" === "abc"` → true ✓
- Action: Accumulate content
- Console: "Accumulating content for same message"
- Result: `streamingContent = "Hello world! How"`

### Final Chunk
- `isComplete: true`
- `messageId: "abc"`
- Action: Add complete message to messages array, clear streaming state
- Set `currentMessageIdRef.current = null`
- Result: Message added to chat history

## Testing
To verify the fix works:
1. Send a message through the chat interface
2. Watch the browser console for logs showing:
   - Chunk 1: "New message or first chunk - replacing content"
   - Chunk 2+: "Accumulating content for same message" ✓
   - "Previous messageId (ref): abc" (should match current messageId after first chunk)
   - "Previous streaming content length: X"
   - "Adding content length: Y"
   - "New total content length: X+Y"
3. Verify the message content grows in the UI with each chunk
4. Verify the final complete message appears correctly

## Why useRef Instead of useState?

| Feature | useState | useRef |
|---------|----------|--------|
| Update timing | Asynchronous | Synchronous |
| Causes re-render | Yes | No |
| Value in closure | Stale until re-render | Always current |
| Best for | UI state | Tracking values in callbacks |

For tracking message IDs in fast-arriving WebSocket events, `useRef` is the correct choice because:
- Updates are immediate and available in the next callback
- No unnecessary re-renders
- No closure/stale state issues

## Notes
- The fix assumes the backend sends the same `messageId` for all chunks of a streaming response
- If the backend sends incremental tokens, content will accumulate correctly
- If the backend sends full accumulated content each time, the last chunk will be displayed (which is also correct)
- The ref is cleared to `null` when the message is complete, ready for the next streaming response
