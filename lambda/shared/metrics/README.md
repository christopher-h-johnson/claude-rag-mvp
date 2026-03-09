# CloudWatch Metrics Emitter

A reusable utility for emitting custom metrics to Amazon CloudWatch from AWS Lambda functions.

## Features

- **Execution Duration Metrics**: Track Lambda function execution times
- **Query Latency Metrics**: Monitor chat query processing latency
- **Embedding Generation Metrics**: Track embedding generation performance
- **Search Latency Metrics**: Monitor vector search performance
- **Token Usage Metrics**: Track Bedrock API token consumption (input, output, total)
- **Custom Dimensions**: Add dimensions like userId, functionName, model, etc.
- **Buffering**: Automatically buffers metrics for efficient batch emission
- **Error Handling**: Graceful error handling - metrics failures don't break application flow

## Installation

```bash
cd lambda/shared/metrics
npm install
npm run build
```

## Usage

### Basic Usage

```typescript
import { emitExecutionDuration, emitQueryLatency, flushMetrics } from 'metrics';

// Emit execution duration
await emitExecutionDuration({
    functionName: 'chat-handler',
    duration: 1500, // milliseconds
    userId: 'user-123',
});

// Emit query latency
await emitQueryLatency({
    latency: 500, // milliseconds
    userId: 'user-123',
    cached: false,
});

// Flush buffered metrics (important at end of Lambda execution)
await flushMetrics();
```

### Advanced Usage with MetricsEmitter Class

```typescript
import { MetricsEmitter, MetricUnit } from 'metrics';

const emitter = new MetricsEmitter({
    namespace: 'MyApp/CustomNamespace',
    region: 'us-east-1',
    consoleLogging: true,
    defaultDimensions: [
        { Name: 'Environment', Value: 'production' },
        { Name: 'Service', Value: 'rag-chatbot' },
    ],
});

// Emit custom metric
await emitter.emitMetric({
    metricName: 'CustomMetric',
    value: 42,
    unit: MetricUnit.Count,
    dimensions: [
        { Name: 'CustomDimension', Value: 'value' },
    ],
});

// Flush metrics
await emitter.flush();
```

## API Reference

### Convenience Functions

#### `emitExecutionDuration(data: ExecutionDurationMetric): Promise<void>`

Emit Lambda execution duration metric.

```typescript
await emitExecutionDuration({
    functionName: 'chat-handler',
    duration: 1500, // milliseconds
    userId: 'user-123', // optional
});
```

#### `emitQueryLatency(data: QueryLatencyMetric): Promise<void>`

Emit query processing latency metric.

```typescript
await emitQueryLatency({
    latency: 500, // milliseconds
    userId: 'user-123', // optional
    cached: false, // optional
});
```

#### `emitEmbeddingGenerationTime(data: EmbeddingGenerationMetric): Promise<void>`

Emit embedding generation time metric.

```typescript
await emitEmbeddingGenerationTime({
    generationTime: 3000, // milliseconds
    chunkCount: 25,
    documentId: 'doc-123', // optional
});
```

#### `emitSearchLatency(data: SearchLatencyMetric): Promise<void>`

Emit vector search latency metric.

```typescript
await emitSearchLatency({
    latency: 150, // milliseconds
    resultCount: 5,
    userId: 'user-123', // optional
});
```

#### `emitTokenUsage(data: TokenUsageMetric): Promise<void>`

Emit Bedrock token usage metrics (input, output, and total).

```typescript
await emitTokenUsage({
    inputTokens: 100,
    outputTokens: 200,
    userId: 'user-123', // optional
    model: 'claude-haiku-4.5', // optional
});
```

#### `flushMetrics(): Promise<void>`

Flush all buffered metrics to CloudWatch immediately.

```typescript
await flushMetrics();
```

### MetricsEmitter Class

#### Constructor

```typescript
const emitter = new MetricsEmitter({
    namespace: 'AWS/Lambda/RAGChatbot', // default
    region: 'us-east-1', // default: process.env.AWS_REGION
    consoleLogging: true, // default: true
    defaultDimensions: [], // default: []
});
```

#### Methods

- `emitExecutionDuration(data: ExecutionDurationMetric): Promise<void>`
- `emitQueryLatency(data: QueryLatencyMetric): Promise<void>`
- `emitEmbeddingGenerationTime(data: EmbeddingGenerationMetric): Promise<void>`
- `emitSearchLatency(data: SearchLatencyMetric): Promise<void>`
- `emitTokenUsage(data: TokenUsageMetric): Promise<void>`
- `emitMetric(metric: CustomMetric): Promise<void>`
- `emitMetrics(metrics: CustomMetric[]): Promise<void>`
- `flush(): Promise<void>`

## Metric Buffering

Metrics are automatically buffered and flushed in the following scenarios:

1. **Buffer Full**: When 20 metrics are buffered (auto-flush)
2. **Manual Flush**: When `flush()` or `flushMetrics()` is called
3. **Scheduled Flush**: After 5 seconds of inactivity (auto-scheduled)

**Important**: Always call `flushMetrics()` at the end of your Lambda handler to ensure all metrics are sent before the function terminates.

## Lambda Integration Example

```typescript
import { Context } from 'aws-lambda';
import { emitExecutionDuration, flushMetrics } from 'metrics';

export const handler = async (event: any, context: Context) => {
    const startTime = Date.now();

    try {
        // Your Lambda logic here
        const result = await processRequest(event);

        // Emit execution duration
        await emitExecutionDuration({
            functionName: context.functionName,
            duration: Date.now() - startTime,
            userId: event.requestContext?.authorizer?.userId,
        });

        // Flush metrics before returning
        await flushMetrics();

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error) {
        // Emit execution duration even on error
        await emitExecutionDuration({
            functionName: context.functionName,
            duration: Date.now() - startTime,
        });

        // Flush metrics
        await flushMetrics();

        throw error;
    }
};
```

## CloudWatch Metrics

The following metrics are emitted to CloudWatch:

| Metric Name | Unit | Dimensions | Description |
|-------------|------|------------|-------------|
| `ExecutionDuration` | Milliseconds | FunctionName, UserId (optional) | Lambda execution duration |
| `QueryLatency` | Milliseconds | UserId (optional), Cached (optional) | Query processing latency |
| `EmbeddingGenerationTime` | Milliseconds | ChunkCount, DocumentId (optional) | Embedding generation time |
| `SearchLatency` | Milliseconds | ResultCount, UserId (optional) | Vector search latency |
| `BedrockInputTokens` | Count | UserId (optional), Model (optional) | Bedrock input tokens |
| `BedrockOutputTokens` | Count | UserId (optional), Model (optional) | Bedrock output tokens |
| `BedrockTotalTokens` | Count | UserId (optional), Model (optional) | Total Bedrock tokens |

## Testing

```bash
npm test
```

## Requirements

Validates requirements:
- **15.1**: Lambda execution duration metrics
- **15.3**: Bedrock token usage metrics

## IAM Permissions

The Lambda execution role needs the following CloudWatch permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudwatch:PutMetricData"
            ],
            "Resource": "*"
        }
    ]
}
```

## License

MIT
