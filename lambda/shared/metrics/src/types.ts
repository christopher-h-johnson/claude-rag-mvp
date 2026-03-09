/**
 * CloudWatch Metrics Types
 * 
 * Type definitions for CloudWatch metrics emission.
 */

/**
 * Metric dimension for filtering and grouping metrics
 */
export interface MetricDimension {
    Name: string;
    Value: string;
}

/**
 * Custom metric data
 */
export interface CustomMetric {
    metricName: string;
    value: number;
    unit: MetricUnit;
    dimensions?: MetricDimension[];
    timestamp?: Date;
}

/**
 * CloudWatch metric units
 */
export enum MetricUnit {
    Seconds = 'Seconds',
    Microseconds = 'Microseconds',
    Milliseconds = 'Milliseconds',
    Bytes = 'Bytes',
    Kilobytes = 'Kilobytes',
    Megabytes = 'Megabytes',
    Gigabytes = 'Gigabytes',
    Terabytes = 'Terabytes',
    Bits = 'Bits',
    Kilobits = 'Kilobits',
    Megabits = 'Megabits',
    Gigabits = 'Gigabits',
    Terabits = 'Terabits',
    Percent = 'Percent',
    Count = 'Count',
    BytesPerSecond = 'Bytes/Second',
    KilobytesPerSecond = 'Kilobytes/Second',
    MegabytesPerSecond = 'Megabytes/Second',
    GigabytesPerSecond = 'Gigabytes/Second',
    TerabytesPerSecond = 'Terabytes/Second',
    BitsPerSecond = 'Bits/Second',
    KilobitsPerSecond = 'Kilobits/Second',
    MegabitsPerSecond = 'Megabits/Second',
    GigabitsPerSecond = 'Gigabits/Second',
    TerabitsPerSecond = 'Terabits/Second',
    CountPerSecond = 'Count/Second',
    None = 'None',
}

/**
 * Configuration for MetricsEmitter
 */
export interface MetricsConfig {
    /**
     * CloudWatch namespace for metrics
     * Default: 'AWS/Lambda/RAGChatbot'
     */
    namespace?: string;

    /**
     * AWS region
     * Default: process.env.AWS_REGION
     */
    region?: string;

    /**
     * Whether to enable console logging of metrics
     * Default: true
     */
    consoleLogging?: boolean;

    /**
     * Default dimensions to add to all metrics
     */
    defaultDimensions?: MetricDimension[];
}

/**
 * Execution duration metric data
 */
export interface ExecutionDurationMetric {
    functionName: string;
    duration: number;
    userId?: string;
}

/**
 * Query latency metric data
 */
export interface QueryLatencyMetric {
    latency: number;
    userId?: string;
    cached?: boolean;
}

/**
 * Embedding generation time metric data
 */
export interface EmbeddingGenerationMetric {
    generationTime: number;
    chunkCount: number;
    documentId?: string;
}

/**
 * Search latency metric data
 */
export interface SearchLatencyMetric {
    latency: number;
    resultCount: number;
    userId?: string;
    averageScore?: number;
    maxScore?: number;
    minScore?: number;
}

/**
 * Bedrock token usage metric data
 */
export interface TokenUsageMetric {
    inputTokens: number;
    outputTokens: number;
    userId?: string;
    model?: string;
}
