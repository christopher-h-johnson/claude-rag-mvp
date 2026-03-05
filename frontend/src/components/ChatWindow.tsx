/**
 * ChatWindow Component
 * 
 * Displays chat message history with streaming responses and document citations.
 */

import React, { useEffect, useRef } from 'react';
import type { ChatMessage, DocumentChunk } from '../types/api';
import Message from './Message';
import TypingIndicator from './TypingIndicator';
import './ChatWindow.css';

interface ChatWindowProps {
    messages: ChatMessage[];
    isTyping: boolean;
    streamingContent?: string;
    streamingRAGChunks?: DocumentChunk[];
    className?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
    messages,
    isTyping,
    streamingContent,
    streamingRAGChunks,
    className = ''
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Log streaming content changes
    useEffect(() => {
        if (streamingContent) {
            console.log('ChatWindow received streaming content:', streamingContent.substring(0, 50));
        }
    }, [streamingContent]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent, isTyping]);

    // Debug: Log render state
    console.log('ChatWindow render state:', {
        hasStreamingContent: !!streamingContent,
        streamingLength: streamingContent?.length,
        hasStreamingRAGChunks: !!streamingRAGChunks,
        ragChunksCount: streamingRAGChunks?.length,
        isTyping,
        messageCount: messages.length
    });

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
                                {chunk.score && (
                                    <span className="citation-score" title="Relevance score">
                                        {(chunk.score * 100).toFixed(0)}%
                                    </span>
                                )}
                            </div>
                            <div className="citation-text">
                                {chunk.text}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className={`chat-window ${className}`} ref={containerRef}>
            <div className="messages-container">
                {messages.map((message) => (
                    <Message key={message.messageId} message={message} />
                ))}

                {/* Show streaming content as it arrives */}
                {streamingContent && (
                    <div className="message assistant streaming">
                        <div className="message-content">
                            {streamingContent}
                        </div>
                        {/* Show RAG chunks with streaming content */}
                        {streamingRAGChunks && streamingRAGChunks.length > 0 && (
                            <div className="message-footer">
                                {renderStreamingCitations(streamingRAGChunks)}
                            </div>
                        )}
                    </div>
                )}

                {/* Show typing indicator while waiting for response */}
                {isTyping && !streamingContent && <TypingIndicator />}

                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};

export default ChatWindow;
