/**
 * CloudWatch Metrics Emitter
 * 
 * Provides utilities for emitting custom metrics to CloudWatch.
 * Implements requirements 15.1 and 15.3 from the design specification.
 * 
 * Features:
 * - Emit execution duration for Lambda invocations
 * - Emit custom metrics: query_latency, embedding_generation_time, search_latency
 * - Emit Bedrock token usage metrics (input_tokens, output_tokens)
 * - Support for custom dimensions (userId, functionName, etc.)
 * - Batch metric emission for efficiency
 * 
 * Validates: Requirements 15.1, 15.3
 */

import {
    CloudWatchClient,
    PutMetricDataCommand,
    MetricDatum,
    StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import {
    MetricsConfig,
    CustomMetric,
    MetricDimension,
    MetricUnit,
    ExecutionDurationMetric,
    QueryLatencyMetric,
    EmbeddingGenerationMetric,
    SearchLatencyMetric,
    TokenUsageMetric,
} from './types.js';

/**
 * CloudWatch Metrics Emitter
 * 
 * Singleton class for emitting metrics to CloudWatch.
 */
export class MetricsEmitter {
    private client: CloudWatchClient;
    private config: Required<MetricsConfig>;
    private metricBuffer: MetricDatum[] = [];
    private flushTimer: NodeJS.Timeout | null = null;

    constructor(config: MetricsConfig = {}) {
        this.config = {
            namespace: config.namespace || 'ChatbotMetrics',
            region: config.region || process.env.AWS_REGION || 'us-east-1',
            consoleLogging: config.consoleLogging !== undefined ? config.consoleLogging : true,
            defaultDimensions: config.defaultDimensions || [],
        };

        this.client = new CloudWatchClient({ region: this.config.region });
    }

    /**
     * Emit execution duration metric for Lambda invocation
     * 
     * @param data Execution duration metric data
     * 
     * Validates: Requirement 15.1
     */
    async emitExecutionDuration(data: ExecutionDurationMetric): Promise<void> {
        const dimensions: MetricDimension[] = [
            { Name: 'FunctionName', Value: data.functionName },
            ...this.config.defaultDimensions,
        ];

        if (data.userId) {
            dimensions.push({ Name: 'UserId', Value: data.userId });
        }

        await this.emitMetric({
            metricName: 'ExecutionDuration',
            value: data.duration,
            unit: MetricUnit.Milliseconds,
            dimensions,
        });
    }

    /**
     * Emit query latency metric
     * 
     * @param data Query latency metric data
     * 
     * Validates: Requirement 15.1
     */
    async emitQueryLatency(data: QueryLatencyMetric): Promise<void> {
        const dimensions: MetricDimension[] = [
            ...this.config.defaultDimensions,
        ];

        if (data.userId) {
            dimensions.push({ Name: 'UserId', Value: data.userId });
        }

        if (data.cached !== undefined) {
            dimensions.push({ Name: 'Cached', Value: data.cached ? 'true' : 'false' });
        }

        await this.emitMetric({
            metricName: 'QueryLatency',
            value: data.latency,
            unit: MetricUnit.Milliseconds,
            dimensions,
        });
    }

    /**
     * Emit embedding generation time metric
     * 
     * @param data Embedding generation metric data
     * 
     * Validates: Requirement 15.1
     */
    async emitEmbeddingGenerationTime(data: EmbeddingGenerationMetric): Promise<void> {
        const dimensions: MetricDimension[] = [
            { Name: 'ChunkCount', Value: String(data.chunkCount) },
            ...this.config.defaultDimensions,
        ];

        if (data.documentId) {
            dimensions.push({ Name: 'DocumentId', Value: data.documentId });
        }

        await this.emitMetric({
            metricName: 'EmbeddingGenerationTime',
            value: data.generationTime,
            unit: MetricUnit.Milliseconds,
            dimensions,
        });
    }

    /**
     * Emit search latency metric
     * 
     * @param data Search latency metric data
     * 
     * Validates: Requirement 15.1
     */
    async emitSearchLatency(data: SearchLatencyMetric): Promise<void> {
        const dimensions: MetricDimension[] = [
            { Name: 'ResultCount', Value: String(data.resultCount) },
            ...this.config.defaultDimensions,
        ];

        if (data.userId) {
            dimensions.push({ Name: 'UserId', Value: data.userId });
        }

        await this.emitMetric({
            metricName: 'SearchLatency',
            value: data.latency,
            unit: MetricUnit.Milliseconds,
            dimensions,
        });

        // Emit score metrics if available
        if (data.averageScore !== undefined) {
            await this.emitMetric({
                metricName: 'SearchAverageScore',
                value: data.averageScore,
                unit: MetricUnit.None,
                dimensions,
            });
        }

        if (data.maxScore !== undefined) {
            await this.emitMetric({
                metricName: 'SearchMaxScore',
                value: data.maxScore,
                unit: MetricUnit.None,
                dimensions,
            });
        }

        if (data.minScore !== undefined) {
            await this.emitMetric({
                metricName: 'SearchMinScore',
                value: data.minScore,
                unit: MetricUnit.None,
                dimensions,
            });
        }
    }

    /**
     * Emit Bedrock token usage metrics
     * 
     * @param data Token usage metric data
     * 
     * Validates: Requirement 15.3
     */
    async emitTokenUsage(data: TokenUsageMetric): Promise<void> {
        const dimensions: MetricDimension[] = [
            ...this.config.defaultDimensions,
        ];

        if (data.userId) {
            dimensions.push({ Name: 'UserId', Value: data.userId });
        }

        if (data.model) {
            dimensions.push({ Name: 'Model', Value: data.model });
        }

        // Emit input tokens metric
        await this.emitMetric({
            metricName: 'BedrockInputTokens',
            value: data.inputTokens,
            unit: MetricUnit.Count,
            dimensions,
        });

        // Emit output tokens metric
        await this.emitMetric({
            metricName: 'BedrockOutputTokens',
            value: data.outputTokens,
            unit: MetricUnit.Count,
            dimensions,
        });

        // Emit total tokens metric for convenience
        await this.emitMetric({
            metricName: 'BedrockTotalTokens',
            value: data.inputTokens + data.outputTokens,
            unit: MetricUnit.Count,
            dimensions,
        });
    }

    /**
     * Emit a custom metric
     * 
     * @param metric Custom metric data
     */
    async emitMetric(metric: CustomMetric): Promise<void> {
        const metricDatum: MetricDatum = {
            MetricName: metric.metricName,
            Value: metric.value,
            Unit: this.mapMetricUnit(metric.unit),
            Timestamp: metric.timestamp || new Date(),
            Dimensions: metric.dimensions?.map(d => ({
                Name: d.Name,
                Value: d.Value,
            })),
        };

        // Console logging for debugging
        if (this.config.consoleLogging) {
            console.log('CloudWatch Metric:', JSON.stringify({
                namespace: this.config.namespace,
                metric: metricDatum,
            }));
        }

        // Add to buffer
        this.metricBuffer.push(metricDatum);

        // Flush if buffer is full (CloudWatch allows max 1000 metrics per request, but we'll use 20 for efficiency)
        if (this.metricBuffer.length >= 20) {
            await this.flush();
        } else {
            // Schedule a flush if not already scheduled
            this.scheduleFlush();
        }
    }

    /**
     * Emit multiple metrics at once
     * 
     * @param metrics Array of custom metrics
     */
    async emitMetrics(metrics: CustomMetric[]): Promise<void> {
        for (const metric of metrics) {
            await this.emitMetric(metric);
        }
    }

    /**
     * Flush buffered metrics to CloudWatch
     */
    async flush(): Promise<void> {
        if (this.metricBuffer.length === 0) {
            return;
        }

        // Clear the flush timer
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        // Get metrics to send and clear buffer
        const metricsToSend = [...this.metricBuffer];
        this.metricBuffer = [];

        try {
            const command = new PutMetricDataCommand({
                Namespace: this.config.namespace,
                MetricData: metricsToSend,
            });

            await this.client.send(command);

            if (this.config.consoleLogging) {
                console.log(`Successfully emitted ${metricsToSend.length} metrics to CloudWatch`);
            }
        } catch (error) {
            console.error('Failed to emit metrics to CloudWatch:', error);
            // Don't throw - metrics emission should not break application flow
        }
    }

    /**
     * Schedule a flush of buffered metrics
     * Metrics will be flushed after 5 seconds of inactivity
     */
    private scheduleFlush(): void {
        if (this.flushTimer) {
            return; // Already scheduled
        }

        this.flushTimer = setTimeout(() => {
            this.flush().catch(error => {
                console.error('Error flushing metrics:', error);
            });
        }, 5000); // 5 seconds
    }

    /**
     * Map MetricUnit enum to CloudWatch StandardUnit
     */
    private mapMetricUnit(unit: MetricUnit): StandardUnit {
        // The MetricUnit enum values match StandardUnit values
        return unit as StandardUnit;
    }
}

/**
 * Singleton instance of MetricsEmitter
 */
let metricsEmitterInstance: MetricsEmitter | null = null;

/**
 * Get the singleton MetricsEmitter instance
 * 
 * @param config Optional configuration (only used on first call)
 * @returns MetricsEmitter instance
 */
export function getMetricsEmitter(config?: MetricsConfig): MetricsEmitter {
    if (!metricsEmitterInstance) {
        metricsEmitterInstance = new MetricsEmitter(config);
    }
    return metricsEmitterInstance;
}

/**
 * Convenience function to emit execution duration metric
 */
export async function emitExecutionDuration(data: ExecutionDurationMetric): Promise<void> {
    const emitter = getMetricsEmitter();
    await emitter.emitExecutionDuration(data);
}

/**
 * Convenience function to emit query latency metric
 */
export async function emitQueryLatency(data: QueryLatencyMetric): Promise<void> {
    const emitter = getMetricsEmitter();
    await emitter.emitQueryLatency(data);
}

/**
 * Convenience function to emit embedding generation time metric
 */
export async function emitEmbeddingGenerationTime(data: EmbeddingGenerationMetric): Promise<void> {
    const emitter = getMetricsEmitter();
    await emitter.emitEmbeddingGenerationTime(data);
}

/**
 * Convenience function to emit search latency metric
 */
export async function emitSearchLatency(data: SearchLatencyMetric): Promise<void> {
    const emitter = getMetricsEmitter();
    await emitter.emitSearchLatency(data);
}

/**
 * Convenience function to emit token usage metrics
 */
export async function emitTokenUsage(data: TokenUsageMetric): Promise<void> {
    const emitter = getMetricsEmitter();
    await emitter.emitTokenUsage(data);
}

/**
 * Convenience function to flush buffered metrics
 */
export async function flushMetrics(): Promise<void> {
    const emitter = getMetricsEmitter();
    await emitter.flush();
}
