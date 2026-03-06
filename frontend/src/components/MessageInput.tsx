/**
 * MessageInput Component
 * 
 * Input field with send button for submitting chat messages.
 */

import React, { useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import './MessageInput.css';

interface MessageInputProps {
    onSendMessage: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
    onSendMessage,
    disabled = false,
    placeholder = 'Type your message...'
}) => {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
        const trimmedMessage = message.trim();
        if (trimmedMessage && !disabled) {
            onSendMessage(trimmedMessage);
            setMessage('');

            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Send on Enter, new line on Shift+Enter
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);

        // Auto-resize textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    return (
        <div className="message-input">
            <textarea
                ref={textareaRef}
                value={message}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className="message-textarea"
                rows={1}
            />
            <button
                onClick={handleSend}
                disabled={disabled || !message.trim()}
                className="send-button"
                aria-label="Send message"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path d="M2 10L18 2L10 18L8 11L2 10Z" />
                </svg>
            </button>
        </div>
    );
};

export default MessageInput;
