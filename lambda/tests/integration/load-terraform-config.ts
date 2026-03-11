/**
 * Load test configuration from Terraform outputs
 * 
 * This module provides a utility to load AWS resource names and endpoints
 * from Terraform outputs using the `terraform output` command.
 * Falls back to environment variables or defaults if Terraform is not available.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface TerraformOutputs {
    s3_documents_bucket_name?: { value: string };
    dynamodb_document_metadata_table_name?: { value: string };
    dynamodb_sessions_table_name?: { value: string };
    dynamodb_chat_history_table_name?: { value: string };
    dynamodb_rate_limits_table_name?: { value: string };
    dynamodb_connections_table_name?: { value: string };
    opensearch_endpoint?: { value: string };
    redis_endpoint?: { value: string };
    redis_port?: { value: number };
    rest_api_url?: { value: string };
    rest_api_id?: { value: string };
    websocket_stage_url?: { value: string };
    websocket_api_id?: { value: string };
    websocket_api_endpoint?: { value: string };
    kms_key_arn?: { value: string };
    environment?: { value: string };
    lambda_execution_role_name?: { value: string };
    lambda_execution_role_arn?: { value: string };
}

interface TestConfig {
    region: string;
    environment: string;
    documentsBucket: string;
    documentMetadataTable: string;
    sessionsTable: string;
    chatHistoryTable: string;
    rateLimitsTable: string;
    connectionsTable: string;
    opensearchEndpoint: string;
    redisEndpoint: string;
    redisPort: number;
    restApiUrl: string;
    restApiId: string;
    websocketApiUrl: string;
    websocketApiId: string;
    kmsKeyArn: string;
    lambdaExecutionRoleName: string;
    lambdaExecutionRoleArn: string;
    testTimeout: number;
}

/**
 * Load Terraform outputs using terraform output command
 */
function loadTerraformOutputs(): TerraformOutputs | null {
    try {
        const terraformDir = path.join(__dirname, '../../../terraform');

        // Check if terraform directory exists
        if (!fs.existsSync(terraformDir)) {
            console.warn('Terraform directory not found, using environment variables');
            return null;
        }

        // Use terraform output command to get outputs
        try {
            const outputJson = execSync('terraform output -json', {
                cwd: terraformDir,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
            });

            // Check if output is empty
            if (!outputJson || outputJson.trim().length === 0) {
                console.warn('terraform output returned empty result, using environment variables');
                return null;
            }

            const outputs = JSON.parse(outputJson);

            if (outputs && Object.keys(outputs).length > 0) {
                console.log('✓ Loaded configuration from terraform output command');
                return outputs as TerraformOutputs;
            } else {
                console.warn('terraform output has no outputs, using environment variables');
                return null;
            }
        } catch (cmdError) {
            console.warn('Could not execute terraform output command, using environment variables');
            return null;
        }
    } catch (error) {
        console.warn('Failed to load Terraform outputs:', error instanceof Error ? error.message : error);
        return null;
    }
}


/**
 * Get test configuration from Terraform outputs or environment variables
 */
export function getTestConfig(): TestConfig {
    const terraformOutputs = loadTerraformOutputs();

    // Helper to get value from Terraform output, env var, or default
    const getValue = (
        tfKey: keyof TerraformOutputs,
        envKey: string,
        defaultValue: string
    ): string => {
        // First try Terraform output
        if (terraformOutputs && terraformOutputs[tfKey]) {
            const output = terraformOutputs[tfKey];
            if (output && 'value' in output) {
                return String(output.value);
            }
        }

        // Then try environment variable
        if (process.env[envKey]) {
            return process.env[envKey]!;
        }

        // Finally use default
        return defaultValue;
    };

    const config: TestConfig = {
        region: process.env.AWS_REGION || 'us-east-2',
        environment: getValue(
            'environment',
            'ENVIRONMENT',
            'dev'
        ),
        documentsBucket: getValue(
            's3_documents_bucket_name',
            'DOCUMENTS_BUCKET',
            'chatbot-documents-test'
        ),
        documentMetadataTable: getValue(
            'dynamodb_document_metadata_table_name',
            'DOCUMENT_METADATA_TABLE',
            'chatbot-document-metadata'
        ),
        sessionsTable: getValue(
            'dynamodb_sessions_table_name',
            'SESSIONS_TABLE',
            'chatbot-sessions'
        ),
        chatHistoryTable: getValue(
            'dynamodb_chat_history_table_name',
            'CHAT_HISTORY_TABLE',
            'chatbot-chat-history'
        ),
        rateLimitsTable: getValue(
            'dynamodb_rate_limits_table_name',
            'RATE_LIMITS_TABLE',
            'chatbot-rate-limits'
        ),
        connectionsTable: getValue(
            'dynamodb_connections_table_name',
            'CONNECTIONS_TABLE',
            'chatbot-connections'
        ),
        opensearchEndpoint: getValue(
            'opensearch_endpoint',
            'OPENSEARCH_ENDPOINT',
            'localhost:9200'
        ),
        redisEndpoint: getValue(
            'redis_endpoint',
            'REDIS_ENDPOINT',
            'localhost:6379'
        ),
        redisPort: parseInt(
            getValue('redis_port', 'REDIS_PORT', '6379'),
            10
        ),
        restApiUrl: getValue(
            'rest_api_url',
            'REST_API_URL',
            'http://localhost:3000'
        ),
        restApiId: getValue(
            'rest_api_id',
            'REST_API_ID',
            ''
        ),
        websocketApiUrl: getValue(
            'websocket_stage_url',
            'WEBSOCKET_API_URL',
            'ws://localhost:3001'
        ),
        websocketApiId: (() => {
            // Try to get API ID from output first
            const apiId = getValue(
                'websocket_api_id',
                'WEBSOCKET_API_ID',
                ''
            );
            if (apiId) return apiId;

            // Fall back to extracting from websocket_api_endpoint URL
            const endpoint = getValue(
                'websocket_api_endpoint',
                'WEBSOCKET_API_ENDPOINT',
                ''
            );
            if (endpoint) {
                // Extract API ID from wss://API_ID.execute-api.region.amazonaws.com
                const match = endpoint.match(/wss:\/\/([a-z0-9]+)\.execute-api/);
                if (match) return match[1];
            }

            return '';
        })(),
        kmsKeyArn: getValue(
            'kms_key_arn',
            'KMS_KEY_ARN',
            ''
        ),
        lambdaExecutionRoleName: (() => {
            // Try to get role name from output first
            const roleName = getValue(
                'lambda_execution_role_name',
                'LAMBDA_EXECUTION_ROLE_NAME',
                ''
            );
            if (roleName) return roleName;

            // Fall back to extracting from ARN
            const roleArn = getValue(
                'lambda_execution_role_arn',
                'LAMBDA_EXECUTION_ROLE_ARN',
                ''
            );
            if (roleArn) {
                const match = roleArn.match(/role\/(.+)$/);
                if (match) return match[1];
            }

            return 'dev-lambda-execution';
        })(),
        lambdaExecutionRoleArn: getValue(
            'lambda_execution_role_arn',
            'LAMBDA_EXECUTION_ROLE_ARN',
            ''
        ),
        testTimeout: parseInt(process.env.TEST_TIMEOUT || '60000', 10),
    };

    // Log configuration source
    if (terraformOutputs) {
        console.log('Using configuration from Terraform outputs');
    } else if (process.env.DOCUMENTS_BUCKET) {
        console.log('Using configuration from environment variables');
    } else {
        console.log('Using default test configuration (local development)');
    }

    return config;
}

/**
 * Validate that required AWS resources are accessible
 */
export async function validateTestConfig(config: TestConfig): Promise<boolean> {
    const requiredFields = [
        'documentsBucket',
        'documentMetadataTable',
        'sessionsTable',
        'chatHistoryTable',
    ];

    const missingFields = requiredFields.filter(
        (field) => !config[field as keyof TestConfig]
    );

    if (missingFields.length > 0) {
        console.error('Missing required configuration fields:');
        missingFields.forEach((field) => console.error(`  - ${field}`));
        return false;
    }

    return true;
}

/**
 * Display test configuration for debugging
 */
export function displayTestConfig(config: TestConfig): void {
    console.log('\nTest Configuration:');
    console.log('==================');
    console.log(`  AWS Region: ${config.region}`);
    console.log(`  Documents Bucket: ${config.documentsBucket}`);
    console.log(`  Document Metadata Table: ${config.documentMetadataTable}`);
    console.log(`  Sessions Table: ${config.sessionsTable}`);
    console.log(`  Chat History Table: ${config.chatHistoryTable}`);
    console.log(`  Rate Limits Table: ${config.rateLimitsTable}`);
    console.log(`  Connections Table: ${config.connectionsTable}`);
    console.log(`  OpenSearch Endpoint: ${config.opensearchEndpoint}`);
    console.log(`  Redis Endpoint: ${config.redisEndpoint}:${config.redisPort}`);
    console.log(`  REST API URL: ${config.restApiUrl}`);
    console.log(`  WebSocket API URL: ${config.websocketApiUrl}`);
    console.log(`  Test Timeout: ${config.testTimeout}ms`);
    console.log('==================\n');
}
