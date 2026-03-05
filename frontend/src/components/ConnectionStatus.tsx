/**
 * ConnectionStatus Component
 * 
 * Displays WebSocket connection status with reconnection information.
 */

import React from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import type { WebSocketConnectionState } from '../utils/websocket';
import './ConnectionStatus.css';

export interface ConnectionStatusProps {
    state: WebSocketConnectionState;
    reconnectAttempt?: number;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
    state,
    reconnectAttempt,
    maxReconnectAttempts,
    reconnectDelay
}) => {
    const getStatusConfig = () => {
        switch (state) {
            case 'connecting':
                return {
                    severity: 'info' as const,
                    title: 'Connecting',
                    message: 'Establishing connection to chat server...',
                    showProgress: true
                };
            case 'connected':
                return {
                    severity: 'success' as const,
                    title: 'Connected',
                    message: 'You are connected to the chat server.',
                    showProgress: false
                };
            case 'disconnected':
                if (reconnectAttempt && maxReconnectAttempts) {
                    return {
                        severity: 'warning' as const,
                        title: 'Disconnected',
                        message: reconnectDelay
                            ? `Reconnecting in ${Math.ceil(reconnectDelay / 1000)}s (attempt ${reconnectAttempt}/${maxReconnectAttempts})...`
                            : `Reconnecting (attempt ${reconnectAttempt}/${maxReconnectAttempts})...`,
                        showProgress: true
                    };
                }
                return {
                    severity: 'warning' as const,
                    title: 'Disconnected',
                    message: 'Connection to chat server lost. Attempting to reconnect...',
                    showProgress: true
                };
            case 'error':
                return {
                    severity: 'error' as const,
                    title: 'Connection Error',
                    message: reconnectAttempt && maxReconnectAttempts && reconnectAttempt >= maxReconnectAttempts
                        ? 'Unable to connect to chat server. Please refresh the page to try again.'
                        : 'Connection error occurred. Attempting to reconnect...',
                    showProgress: reconnectAttempt && maxReconnectAttempts ? reconnectAttempt < maxReconnectAttempts : true
                };
            default:
                return {
                    severity: 'info' as const,
                    title: 'Status Unknown',
                    message: 'Connection status unknown.',
                    showProgress: false
                };
        }
    };

    const config = getStatusConfig();

    // Don't show status for connected state (only show when there's an issue)
    if (state === 'connected') {
        return null;
    }

    return (
        <Alert
            severity={config.severity}
            className="connection-status"
            icon={config.showProgress ? <CircularProgress size={20} /> : undefined}
        >
            <Box>
                <Typography variant="subtitle2" fontWeight="bold">
                    {config.title}
                </Typography>
                <Typography variant="body2">
                    {config.message}
                </Typography>
            </Box>
        </Alert>
    );
};

export default ConnectionStatus;
