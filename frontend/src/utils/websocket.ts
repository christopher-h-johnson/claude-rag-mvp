/**
 * WebSocket Utility
 * 
 * Manages WebSocket connections with automatic reconnection and exponential backoff.
 */

import type { WebSocketMessage } from '../types/api';

export type WebSocketConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketManagerOptions {
    url: string;
    token: string;
    onMessage: (message: WebSocketMessage) => void;
    onStateChange: (state: WebSocketConnectionState) => void;
    onReconnectAttempt?: (attempt: number, maxAttempts: number, delay: number) => void;
    maxReconnectAttempts?: number;
    reconnectDelays?: number[]; // Exponential backoff delays in ms
}

export class WebSocketManager {
    private ws: WebSocket | null = null;
    private url: string;
    private token: string;
    private onMessage: (message: WebSocketMessage) => void;
    private onStateChange: (state: WebSocketConnectionState) => void;
    private onReconnectAttempt?: (attempt: number, maxAttempts: number, delay: number) => void;
    private reconnectAttempts = 0;
    private maxReconnectAttempts: number;
    private reconnectDelays: number[];
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
    private intentionallyClosed = false;

    constructor(options: WebSocketManagerOptions) {
        this.url = options.url;
        this.token = options.token;
        this.onMessage = options.onMessage;
        this.onStateChange = options.onStateChange;
        this.onReconnectAttempt = options.onReconnectAttempt;
        this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
        this.reconnectDelays = options.reconnectDelays ?? [1000, 2000, 4000, 8000, 16000];
    }

    /**
     * Connect to WebSocket server
     */
    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        this.intentionallyClosed = false;
        this.onStateChange('connecting');

        // Add token as query parameter for authentication
        const wsUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = this.handleOpen.bind(this);
        this.ws.onmessage = this.handleMessage.bind(this);
        this.ws.onerror = this.handleError.bind(this);
        this.ws.onclose = this.handleClose.bind(this);
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void {
        this.intentionallyClosed = true;
        this.clearReconnectTimeout();
        this.clearKeepAlive();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.onStateChange('disconnected');
    }

    /**
     * Send message to server
     */
    send(message: any): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket is not connected');
            throw new Error('WebSocket is not connected');
        }
    }

    /**
     * Get current connection state
     */
    getState(): WebSocketConnectionState {
        if (!this.ws) return 'disconnected';

        switch (this.ws.readyState) {
            case WebSocket.CONNECTING:
                return 'connecting';
            case WebSocket.OPEN:
                return 'connected';
            case WebSocket.CLOSING:
            case WebSocket.CLOSED:
                return 'disconnected';
            default:
                return 'disconnected';
        }
    }

    /**
     * Get current reconnection info
     */
    getReconnectInfo(): { attempt: number; maxAttempts: number } {
        return {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts
        };
    }

    private handleOpen(): void {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.onStateChange('connected');
        this.startKeepAlive();
    }

    private handleMessage(event: MessageEvent): void {
        try {
            console.log('Raw WebSocket message received:', event.data);
            const message = JSON.parse(event.data) as WebSocketMessage;
            console.log('Parsed WebSocket message:', message);
            this.onMessage(message);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            console.error('Raw message data:', event.data);
        }
    }

    private handleError(event: Event): void {
        console.error('WebSocket error event:', event);
        console.error('WebSocket readyState:', this.ws?.readyState);
        console.error('WebSocket URL:', this.url);
        this.onStateChange('error');
    }

    private handleClose(event: CloseEvent): void {
        console.log('WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            intentionallyClosed: this.intentionallyClosed
        });
        this.clearKeepAlive();
        this.onStateChange('disconnected');

        // Attempt reconnection if not intentionally closed
        if (!this.intentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
        }
    }

    private scheduleReconnect(): void {
        this.clearReconnectTimeout();

        // Use exponential backoff with max delay
        const delayIndex = Math.min(this.reconnectAttempts, this.reconnectDelays.length - 1);
        const delay = this.reconnectDelays[delayIndex];

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

        // Notify about reconnection attempt
        if (this.onReconnectAttempt) {
            this.onReconnectAttempt(this.reconnectAttempts + 1, this.maxReconnectAttempts, delay);
        }

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    private clearReconnectTimeout(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    private startKeepAlive(): void {
        this.clearKeepAlive();

        // Send ping every 5 minutes to keep connection alive
        this.keepAliveInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.send({ action: 'ping' });
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    private clearKeepAlive(): void {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }
}
