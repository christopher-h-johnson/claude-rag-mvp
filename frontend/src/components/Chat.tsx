/**
 * Chat Component
 * 
 * Main chat interface that integrates ChatWindow, MessageInput, and WebSocket connection.
 * Implements optimistic UI updates and streaming response handling.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketManager } from '../utils/websocket';
import type { WebSocketConnectionState } from '../utils/websocket';
import { parseError } from '../utils/errorHandler';
import type {
    ChatMessage,
    WebSocketMessage,
    ChatResponseMessage,
    TypingIndicatorMessage,
    ErrorMessage as ErrorMessageType
} from '../types/api';
import ChatWindow from './ChatWindow';
import MessageInput from './MessageInput';
import ConnectionStatus from './ConnectionStatus';
import ErrorMessage from './ErrorMessage';
import RateLimitError from './RateLimitError';
import './Chat.css';

interface ChatProps {
    token: string;
    userId: string;
    sessionId: string;
    websocketUrl: string;
}

const Chat: React.FC<ChatProps> = ({ token, userId, sessionId, websocketUrl }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('disconnected');
    const [wsManager, setWsManager] = useState<WebSocketManager | null>(null);
    const currentMessageIdRef = useRef<string | null>(null);
    const currentRAGChunksRef = useRef<any[] | undefined>(undefined);
    const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
    const [rateLimitError, setRateLimitError] = useState<number | null>(null);
    const [reconnectInfo, setReconnectInfo] = useState<{ attempt: number; maxAttempts: number; delay: number } | null>(null);

    // Initialize WebSocket connection
    useEffect(() => {
        console.log('Initializing WebSocket connection to:', websocketUrl);
        console.log('Using token:', token ? 'Token present' : 'No token');

        const manager = new WebSocketManager({
            url: websocketUrl,
            token,
            onMessage: handleWebSocketMessage,
            onStateChange: (state) => {
                console.log('WebSocket state changed to:', state);
                setConnectionState(state);

                // Show error if connection fails
                if (state === 'error') {
                    setError({
                        message: 'Failed to connect to chat server. The WebSocket API may not be deployed yet.',
                        retryable: true
                    });
                }
            },
            onReconnectAttempt: (attempt, maxAttempts, delay) => {
                console.log(`Reconnection attempt ${attempt}/${maxAttempts}, delay: ${delay}ms`);
                setReconnectInfo({ attempt, maxAttempts, delay });
            }
        });

        manager.connect();
        setWsManager(manager);

        return () => {
            console.log('Cleaning up WebSocket connection');
            manager.disconnect();
        };
    }, [websocketUrl, token]);

    // Handle incoming WebSocket messages
    const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
        console.log('Received WebSocket message:', message);

        try {
            switch (message.type) {
                case 'chat_response':
                    handleChatResponse(message as ChatResponseMessage);
                    break;
                case 'typing_indicator':
                    handleTypingIndicator(message as TypingIndicatorMessage);
                    break;
                case 'error':
                    handleError(message as ErrorMessageType);
                    break;
                default:
                    console.log('Unknown message type:', message);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error, message);
        }
    }, []);

    // Handle chat response (streaming)
    const handleChatResponse = (message: ChatResponseMessage) => {
        // Add safety check for message.payload
        if (!message.payload) {
            console.error('Chat response missing payload:', message);
            return;
        }

        const { messageId, content, isComplete, retrievedChunks } = message.payload;

        // Log the received payload for debugging
        console.log('Chat response payload:', {
            messageId,
            hasContent: !!content,
            content: content?.substring(0, 100), // Log first 100 chars
            contentLength: content?.length || 0,
            isComplete,
            hasRetrievedChunks: !!retrievedChunks,
            chunksCount: retrievedChunks?.length || 0
        });

        // If we have retrieved chunks but no content, this might be a RAG context message
        if (retrievedChunks && retrievedChunks.length > 0 && !content) {
            console.log('Received RAG context with retrieved chunks:', retrievedChunks);
            // Store RAG chunks for the final message
            currentRAGChunksRef.current = retrievedChunks;
            // Show typing indicator while waiting for actual response
            setIsTyping(true);
            return;
        }

        // Store RAG chunks if present in any message
        if (retrievedChunks && retrievedChunks.length > 0) {
            console.log('Storing RAG chunks:', retrievedChunks.length);
            currentRAGChunksRef.current = retrievedChunks;
        }

        if (isComplete) {
            console.log('Complete message received, adding to messages array');
            // Complete message received - add to messages array
            const completeMessage: ChatMessage = {
                messageId: messageId || `msg-${Date.now()}`,
                role: 'assistant',
                content: content || '',
                timestamp: Date.now(),
                metadata: currentRAGChunksRef.current ? { retrievedChunks: currentRAGChunksRef.current } : undefined
            };

            setMessages(prev => [...prev, completeMessage]);
            setStreamingContent('');
            setIsTyping(false);
            currentMessageIdRef.current = null;
            currentRAGChunksRef.current = undefined;
        } else {
            // Streaming token - update streaming content
            if (content) {
                console.log('Streaming update - content length:', content.length);
                console.log('Content preview:', content.substring(0, 100));
                console.log('Current messageId:', messageId, 'Previous messageId (ref):', currentMessageIdRef.current);

                // Check if this is a new message or continuation of existing one
                if (messageId && messageId === currentMessageIdRef.current) {
                    // Same message - accumulate content (backend sending incremental tokens)
                    console.log('Accumulating content for same message');
                    setStreamingContent(prev => {
                        console.log('Previous streaming content length:', prev.length);
                        console.log('Adding content length:', content.length);
                        const newContent = prev + content;
                        console.log('New total content length:', newContent.length);
                        return newContent;
                    });
                } else {
                    // New message or first chunk - replace content
                    // OR backend is sending full accumulated content each time
                    console.log('New message or first chunk - replacing content');
                    setStreamingContent(content);
                    // Update ref immediately for next chunk
                    currentMessageIdRef.current = messageId || null;
                }

                setIsTyping(false);
            } else {
                console.log('No content in streaming message');
            }
        }
    };

    // Handle typing indicator
    const handleTypingIndicator = (message: TypingIndicatorMessage) => {
        setIsTyping(message.payload.isTyping);
    };

    // Handle error messages
    const handleError = (message: ErrorMessageType) => {
        const appError = parseError(message.payload);

        // Check if it's a rate limit error
        if (appError.code === 'RATE_LIMIT_EXCEEDED' && appError.retryAfter) {
            setRateLimitError(appError.retryAfter);
            setError(null);
        } else {
            // Regular error
            setError({ message: appError.message, retryable: appError.retryable });
            setRateLimitError(null);
        }

        setIsTyping(false);
        setStreamingContent('');
    };

    // Send message (optimistic UI update)
    const handleSendMessage = useCallback((content: string) => {
        if (!wsManager || connectionState !== 'connected') {
            setError({
                message: 'Cannot send message: Not connected to server',
                retryable: true
            });
            return;
        }

        // Clear any existing errors
        setError(null);
        setRateLimitError(null);

        // Generate temporary message ID
        const messageId = `temp-${Date.now()}`;

        // Optimistic UI update - display user message immediately
        const userMessage: ChatMessage = {
            messageId,
            role: 'user',
            content,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);

        // Send message via WebSocket
        try {
            wsManager.send({
                action: 'chat_message',
                data: {
                    message: content,
                    sessionId
                }
            });

            // Show typing indicator
            setIsTyping(true);
        } catch (error) {
            console.error('Failed to send message:', error);
            setError({
                message: 'Failed to send message. Please try again.',
                retryable: true
            });
        }
    }, [wsManager, connectionState, sessionId]);

    return (
        <div className="chat-container">
            {/* Connection Status - shows when not connected */}
            {connectionState !== 'connected' && (
                <ConnectionStatus
                    state={connectionState}
                    reconnectAttempt={reconnectInfo?.attempt}
                    maxReconnectAttempts={reconnectInfo?.maxAttempts}
                    reconnectDelay={reconnectInfo?.delay}
                />
            )}

            {/* Rate Limit Error */}
            {rateLimitError && (
                <RateLimitError
                    retryAfterSeconds={rateLimitError}
                    onRetryAvailable={() => setRateLimitError(null)}
                    onDismiss={() => setRateLimitError(null)}
                />
            )}

            {/* General Error Messages */}
            {error && (
                <ErrorMessage
                    title="Error"
                    message={error.message}
                    severity="error"
                    retryable={error.retryable}
                    onRetry={() => {
                        setError(null);
                        // Optionally trigger reconnection if it's a connection error
                        if (connectionState !== 'connected' && wsManager) {
                            wsManager.connect();
                        }
                    }}
                    onDismiss={() => setError(null)}
                />
            )}

            <ChatWindow
                messages={messages}
                isTyping={isTyping}
                streamingContent={streamingContent}
                streamingRAGChunks={currentRAGChunksRef.current}
                className="chat-window-flex"
            />

            <MessageInput
                onSendMessage={handleSendMessage}
                disabled={connectionState !== 'connected' || rateLimitError !== null}
                placeholder={
                    connectionState === 'connected'
                        ? rateLimitError
                            ? 'Rate limit exceeded. Please wait...'
                            : 'Type your message...'
                        : 'Connecting...'
                }
            />
        </div>
    );
};

export default Chat;

