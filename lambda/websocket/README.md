# WebSocket Lambda Functions

This directory contains the Lambda functions for WebSocket connection management.

## Structure

- `connect/` - Handles WebSocket $connect route
- `disconnect/` - Handles WebSocket $disconnect route
- `message/` - Handles WebSocket chat_message route (placeholder)
- `shared/` - Shared utilities and types

## Building

To build all WebSocket Lambda functions:

```bash
cd lambda/websocket

# Install dependencies and build connect handler
cd connect
npm install
npm run build

# Install dependencies and build disconnect handler
cd ../disconnect
npm install
npm run build

# Install dependencies and build message handler
cd ../message
npm install
npm run build

# Build shared utilities
cd ../shared
npm install
npm run build
```

## Shared Utilities

The `shared/` directory contains the `MessageSender` utility class for sending messages to WebSocket connections.

### MessageSender

The `MessageSender` class provides methods for:

- `sendMessage(connectionId, message)` - Send a message to a specific connection
- `broadcastToUser(userId, message)` - Broadcast a message to all connections for a user
- Automatic handling of stale connections (410 Gone errors)
- Helper methods for creating different message types

### Message Types

Supported message types:
- `chat_response` - Chat response with content and metadata
- `typing_indicator` - Typing indicator status
- `error` - Error messages with retry information
- `system` - System notifications

## Usage Example

```typescript
import { MessageSender } from '../shared';

const sender = new MessageSender(
  process.env.WEBSOCKET_API_ENDPOINT!,
  process.env.CONNECTIONS_TABLE!
);

// Send a chat response
const message = MessageSender.createChatResponse(
  'msg-123',
  'Hello, world!',
  true
);
await sender.sendMessage(connectionId, message);

// Broadcast to all user connections
await sender.broadcastToUser(userId, message);
```

## DynamoDB Schema

The WebSocket connections are stored in DynamoDB with the following schema:

```typescript
{
  PK: "CONNECTION#<connectionId>",
  SK: "CONNECTION#<connectionId>",
  connectionId: string,
  userId: string,
  connectedAt: number,
  ttl: number  // 10 minutes from connection
}
```

GSI: `userId-index` (userId, SK) for querying all connections by user.

## Error Handling

- **410 Gone**: Connection is stale, automatically removed from database
- **Other errors**: Logged and propagated to caller
- Stale connection cleanup is non-blocking and won't fail the operation
