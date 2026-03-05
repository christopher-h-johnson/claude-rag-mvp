/**
 * ErrorMessage Component
 * 
 * Displays error messages with appropriate styling and actions.
 */

import React from 'react';
import { Alert, AlertTitle, Button, Box } from '@mui/material';
import './ErrorMessage.css';

export interface ErrorMessageProps {
    title?: string;
    message: string;
    severity?: 'error' | 'warning' | 'info';
    retryable?: boolean;
    onRetry?: () => void;
    onDismiss?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
    title,
    message,
    severity = 'error',
    retryable = false,
    onRetry,
    onDismiss
}) => {
    return (
        <Alert
            severity={severity}
            className="error-message"
            onClose={onDismiss}
        >
            {title && <AlertTitle>{title}</AlertTitle>}
            <Box>{message}</Box>
            {retryable && onRetry && (
                <Box sx={{ mt: 1 }}>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={onRetry}
                        sx={{ color: 'inherit', borderColor: 'inherit' }}
                    >
                        Retry
                    </Button>
                </Box>
            )}
        </Alert>
    );
};

export default ErrorMessage;
