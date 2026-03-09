/**
 * Unit tests for CloudWatch Metrics Emitter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    MetricsEmitter,
    getMetricsEmitter,
    emitExecutionDuration,
    emitQueryLatency,
    emitEmbeddingGenerationTime,
    emitSearchLatency,
    emitTokenUsage,
    flushMetrics,
} from './metrics.js';
import { MetricUnit } from './types.js';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';

// Mock AWS SDK
vi.mock('@aws-sdk/client-cloudwatch', () => {
    const mockSend = vi.fn();
    return {
        CloudWatchClient: vi.fn(() => ({
            send: mockSend,
        })),
        PutMetricDataCommand: vi.fn((input) => input),
        StandardUnit: {
            Seconds: 'Seconds',
            Milliseconds: 'Milliseconds',
            Count: 'Count',
        },
    };
});

describe('MetricsEmitter', () => {
    let mockSend: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Get the mock send function
        const client = new CloudWatchClient({});
        mockSend = client.send as any;

        // Mock successful CloudWatch responses
        mockSend.mockResolvedValue({});
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('Constructor', () => {
        it('should create instance with default config', () => {
            const emitter = new MetricsEmitter();
            expect(emitter).toBeInstanceOf(MetricsEmitter);
        });

        it('should create instance with custom config', () => {
            const emitter = new MetricsEmitter({
                namespace: 'CustomNamespace',
                region: 'us-west-2',
                consoleLogging: false,
            });
            expect(emitter).toBeInstanceOf(MetricsEmitter);
        });

        it('should use default dimensions', () => {
            const emitter = new MetricsEmitter({
                defaultDimensions: [
                    { Name: 'Environment', Value: 'production' },
                ],
            });
            expect(emitter).toBeInstanceOf(MetricsEmitter);
        });
    });

    describe('emitExecutionDuration', () => {
        it('should emit execution duration metric', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitExecutionDuration({
                functionName: 'test-function',
                duration: 1500,
            });

            // Flush to send metrics
            await emitter.flush();

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command.Namespace).toBe('AWS/Lambda/RAGChatbot');
            expect(command.MetricData).toHaveLength(1);
            expect(command.MetricData[0].MetricName).toBe('ExecutionDuration');
            expect(command.MetricData[0].Value).toBe(1500);
            expect(command.MetricData[0].Unit).toBe('Milliseconds');
        });

        it('should include userId dimension when provided', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitExecutionDuration({
                functionName: 'test-function',
                duration: 1500,
                userId: 'user-123',
            });

            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'UserId', Value: 'user-123' });
        });

        it('should include functionName dimension', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitExecutionDuration({
                functionName: 'chat-handler',
                duration: 2000,
            });

            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'FunctionName', Value: 'chat-handler' });
        });
    });

    describe('emitQueryLatency', () => {
        it('should emit query latency metric', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitQueryLatency({
                latency: 500,
            });

            await emitter.flush();

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command.MetricData[0].MetricName).toBe('QueryLatency');
            expect(command.MetricData[0].Value).toBe(500);
            expect(command.MetricData[0].Unit).toBe('Milliseconds');
        });

        it('should include cached dimension when provided', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitQueryLatency({
                latency: 100,
                cached: true,
            });

            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'Cached', Value: 'true' });
        });

        it('should include userId dimension when provided', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitQueryLatency({
                latency: 500,
                userId: 'user-456',
            });

            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'UserId', Value: 'user-456' });
        });
    });

    describe('emitEmbeddingGenerationTime', () => {
        it('should emit embedding generation time metric', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitEmbeddingGenerationTime({
                generationTime: 3000,
                chunkCount: 25,
            });

            await emitter.flush();

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command.MetricData[0].MetricName).toBe('EmbeddingGenerationTime');
            expect(command.MetricData[0].Value).toBe(3000);
            expect(command.MetricData[0].Unit).toBe('Milliseconds');
        });

        it('should include chunkCount dimension', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitEmbeddingGenerationTime({
                generationTime: 3000,
                chunkCount: 50,
            });

            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'ChunkCount', Value: '50' });
        });

        it('should include documentId dimension when provided', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitEmbeddingGenerationTime({
                generationTime: 3000,
                chunkCount: 25,
                documentId: 'doc-789',
            });

            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'DocumentId', Value: 'doc-789' });
        });
    });

    describe('emitSearchLatency', () => {
        it('should emit search latency metric', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitSearchLatency({
                latency: 150,
                resultCount: 5,
            });

            await emitter.flush();

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command.MetricData[0].MetricName).toBe('SearchLatency');
            expect(command.MetricData[0].Value).toBe(150);
            expect(command.MetricData[0].Unit).toBe('Milliseconds');
        });

        it('should include resultCount dimension', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitSearchLatency({
                latency: 150,
                resultCount: 10,
            });

            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'ResultCount', Value: '10' });
        });

        it('should include userId dimension when provided', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitSearchLatency({
                latency: 150,
                resultCount: 5,
                userId: 'user-999',
            });

            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'UserId', Value: 'user-999' });
        });
    });

    describe('emitTokenUsage', () => {
        it('should emit token usage metrics', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitTokenUsage({
                inputTokens: 100,
                outputTokens: 200,
            });

            await emitter.flush();

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command.MetricData).toHaveLength(3); // input, output, total

            // Check input tokens
            const inputMetric = command.MetricData.find((m: any) => m.MetricName === 'BedrockInputTokens');
            expect(inputMetric).toBeDefined();
            expect(inputMetric.Value).toBe(100);
            expect(inputMetric.Unit).toBe('Count');

            // Check output tokens
            const outputMetric = command.MetricData.find((m: any) => m.MetricName === 'BedrockOutputTokens');
            expect(outputMetric).toBeDefined();
            expect(outputMetric.Value).toBe(200);
            expect(outputMetric.Unit).toBe('Count');

            // Check total tokens
            const totalMetric = command.MetricData.find((m: any) => m.MetricName === 'BedrockTotalTokens');
            expect(totalMetric).toBeDefined();
            expect(totalMetric.Value).toBe(300);
            expect(totalMetric.Unit).toBe('Count');
        });

        it('should include userId dimension when provided', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitTokenUsage({
                inputTokens: 100,
                outputTokens: 200,
                userId: 'user-111',
            });

            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'UserId', Value: 'user-111' });
        });

        it('should include model dimension when provided', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitTokenUsage({
                inputTokens: 100,
                outputTokens: 200,
                model: 'claude-haiku-4.5',
            });

            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'Model', Value: 'claude-haiku-4.5' });
        });
    });

    describe('Buffering and Flushing', () => {
        it('should buffer metrics and flush when buffer is full', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            // Emit 20 metrics to trigger auto-flush
            for (let i = 0; i < 20; i++) {
                await emitter.emitQueryLatency({ latency: 100 });
            }

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command.MetricData).toHaveLength(20);
        });

        it('should flush metrics manually', async () => {
            const emitter = new MetricsEmitter({ consoleLogging: false });

            await emitter.emitQueryLatency({ latency: 100 });
            await emitter.emitQueryLatency({ latency: 200 });

            // Manual flush
            await emitter.flush();

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command.MetricData).toHaveLength(2);
        });

        it('should not throw error when CloudWatch write fails', async () => {
            mockSend.mockRejectedValue(new Error('CloudWatch error'));

            const emitter = new MetricsEmitter({ consoleLogging: false });

            await expect(emitter.emitQueryLatency({ latency: 100 })).resolves.not.toThrow();
            await expect(emitter.flush()).resolves.not.toThrow();
        });
    });

    describe('Singleton and Convenience Functions', () => {
        it('should return singleton instance', () => {
            const emitter1 = getMetricsEmitter();
            const emitter2 = getMetricsEmitter();
            expect(emitter1).toBe(emitter2);
        });

        it('should emit execution duration using convenience function', async () => {
            await emitExecutionDuration({
                functionName: 'test-function',
                duration: 1000,
            });

            await flushMetrics();

            expect(mockSend).toHaveBeenCalled();
        });

        it('should emit query latency using convenience function', async () => {
            await emitQueryLatency({
                latency: 500,
            });

            await flushMetrics();

            expect(mockSend).toHaveBeenCalled();
        });

        it('should emit embedding generation time using convenience function', async () => {
            await emitEmbeddingGenerationTime({
                generationTime: 3000,
                chunkCount: 25,
            });

            await flushMetrics();

            expect(mockSend).toHaveBeenCalled();
        });

        it('should emit search latency using convenience function', async () => {
            await emitSearchLatency({
                latency: 150,
                resultCount: 5,
            });

            await flushMetrics();

            expect(mockSend).toHaveBeenCalled();
        });

        it('should emit token usage using convenience function', async () => {
            await emitTokenUsage({
                inputTokens: 100,
                outputTokens: 200,
            });

            await flushMetrics();

            expect(mockSend).toHaveBeenCalled();
        });
    });

    describe('Default Dimensions', () => {
        it('should include default dimensions in all metrics', async () => {
            const emitter = new MetricsEmitter({
                consoleLogging: false,
                defaultDimensions: [
                    { Name: 'Environment', Value: 'production' },
                    { Name: 'Service', Value: 'rag-chatbot' },
                ],
            });

            await emitter.emitQueryLatency({ latency: 500 });
            await emitter.flush();

            const command = mockSend.mock.calls[0][0];
            const dimensions = command.MetricData[0].Dimensions;
            expect(dimensions).toContainEqual({ Name: 'Environment', Value: 'production' });
            expect(dimensions).toContainEqual({ Name: 'Service', Value: 'rag-chatbot' });
        });
    });
});
