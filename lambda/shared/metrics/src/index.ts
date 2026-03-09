/**
 * CloudWatch Metrics - Main Export
 */

export {
    MetricsEmitter,
    getMetricsEmitter,
    emitExecutionDuration,
    emitQueryLatency,
    emitEmbeddingGenerationTime,
    emitSearchLatency,
    emitTokenUsage,
    flushMetrics,
} from './metrics.js';

export type {
    MetricsConfig,
    CustomMetric,
    MetricDimension,
    ExecutionDurationMetric,
    QueryLatencyMetric,
    EmbeddingGenerationMetric,
    SearchLatencyMetric,
    TokenUsageMetric,
} from './types.js';

export { MetricUnit } from './types.js';
