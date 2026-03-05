/**
 * API Configuration
 * 
 * Centralized configuration for API endpoints and WebSocket connections.
 * Uses environment variables for different deployment environments.
 */

export const API_CONFIG = {
    // REST API base URL
    apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',

    // WebSocket API URL
    wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',

    // AWS Region
    awsRegion: import.meta.env.VITE_AWS_REGION || 'us-east-1',

    // API endpoints
    endpoints: {
        auth: {
            login: '/auth/login',
            logout: '/auth/logout',
        },
        documents: {
            upload: '/documents/upload',
            list: '/documents',
            delete: (documentId: string) => `/documents/${documentId}`,
        },
        chat: {
            history: '/chat/history',
        },
    },
} as const;

export default API_CONFIG;
