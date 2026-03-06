/**
 * TypingIndicator Component
 * 
 * Displays animated typing indicator while waiting for assistant response.
 */

import React from 'react';
import './TypingIndicator.css';

const TypingIndicator: React.FC = () => {
    return (
        <div className="message assistant typing-indicator">
            <div className="message-header">
                <span className="message-role">Assistant</span>
            </div>
            <div className="typing-dots">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
            </div>
        </div>
    );
};

export default TypingIndicator;
