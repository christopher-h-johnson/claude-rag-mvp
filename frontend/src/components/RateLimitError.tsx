/**
 * RateLimitError Component
 * 
 * Displays rate limit errors with countdown timer until retry is allowed.
 */

import React, { useState, useEffect } from 'react';
import { Alert, AlertTitle, Box, LinearProgress, Typography } from '@mui/material';
import './RateLimitError.css';

export interface RateLimitErrorProps {
    retryAfterSeconds: number;
    onRetryAvailable?: () => void;
    onDismiss?: () => void;
}

const RateLimitError: React.FC<RateLimitErrorProps> = ({
    retryAfterSeconds,
    onRetryAvailable,
    onDismiss
}) => {
    const [remainingSeconds, setRemainingSeconds] = useState(retryAfterSeconds);

    useEffect(() => {
        if (remainingSeconds <= 0) {
            onRetryAvailable?.();
            return;
        }

        const timer = setInterval(() => {
            setRemainingSeconds(prev => {
                const next = prev - 1;
                if (next <= 0) {
                    clearInterval(timer);
                    onRetryAvailable?.();
                }
                return next;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [remainingSeconds, onRetryAvailable]);

    const progress = ((retryAfterSeconds - remainingSeconds) / retryAfterSeconds) * 100;

    return (
        <Alert
            severity="warning"
            className="rate-limit-error"
            onClose={onDismiss}
        >
            <AlertTitle>Rate Limit Exceeded</AlertTitle>
            <Box>
                <Typography variant="body2" gutterBottom>
                    You've sent too many requests. Please wait before trying again.
                </Typography>
                <Box sx={{ mt: 2, mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Retry available in: <strong>{remainingSeconds}s</strong>
                    </Typography>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ mt: 1 }}
                    />
                </Box>
            </Box>
        </Alert>
    );
};

export default RateLimitError;
