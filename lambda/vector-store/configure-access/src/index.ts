import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

/**
 * Lambda function to configure OpenSearch role mapping for IAM roles.
 * 
 * This function maps Lambda IAM roles to OpenSearch roles, allowing
 * IAM-authenticated requests to access OpenSearch when fine-grained
 * access control is enabled.
 * 
 * This version uses IAM authentication (AWS Signature V4) instead of basic auth.
 * This must be run from within the VPC where OpenSearch is deployed.
 */

interface RoleMappingRequest {
    lambdaRoleArn: string;
    opensearchRole?: string; // Defaults to 'all_access'
}

/**
 * Creates an OpenSearch client with IAM authentication
 */
function createOpenSearchClient(endpoint: string): Client {
    const region = process.env.AWS_REGION || 'us-east-1';

    return new Client({
        ...AwsSigv4Signer({
            region,
            service: 'es',
            getCredentials: defaultProvider()
        }),
        node: `https://${endpoint}`
    });
}

/**
 * Maps a Lambda IAM role to an OpenSearch role
 */
async function mapRoleToOpenSearch(
    client: Client,
    lambdaRoleArn: string,
    opensearchRole: string = 'all_access'
): Promise<{ success: boolean; message: string }> {
    try {
        // Get current role mapping
        console.log(`Fetching current role mapping for ${opensearchRole}...`);

        let currentMapping: any = {};
        try {
            const response = await client.transport.request({
                method: 'GET',
                path: `/_plugins/_security/api/rolesmapping/${opensearchRole}`
            });
            currentMapping = response.body[opensearchRole] || {};
            console.log('Current mapping:', JSON.stringify(currentMapping, null, 2));
        } catch (error: any) {
            if (error.statusCode === 404) {
                console.log(`Role mapping for ${opensearchRole} does not exist, will create new`);
            } else {
                throw error;
            }
        }

        // Add Lambda role to backend_roles if not already present
        const backendRoles = currentMapping.backend_roles || [];
        if (!backendRoles.includes(lambdaRoleArn)) {
            backendRoles.push(lambdaRoleArn);
            console.log(`Adding Lambda role to backend_roles: ${lambdaRoleArn}`);
        } else {
            console.log(`Lambda role already mapped: ${lambdaRoleArn}`);
            return {
                success: true,
                message: `Lambda role ${lambdaRoleArn} is already mapped to ${opensearchRole}`
            };
        }

        // Update role mapping
        const updatedMapping = {
            backend_roles: backendRoles,
            hosts: currentMapping.hosts || [],
            users: currentMapping.users || []
        };

        console.log('Updating role mapping with:', JSON.stringify(updatedMapping, null, 2));

        await client.transport.request({
            method: 'PUT',
            path: `/_plugins/_security/api/rolesmapping/${opensearchRole}`,
            body: updatedMapping
        });

        console.log(`Successfully mapped Lambda role to ${opensearchRole}`);

        return {
            success: true,
            message: `Successfully mapped Lambda role ${lambdaRoleArn} to OpenSearch role ${opensearchRole}`
        };
    } catch (error: any) {
        console.error('Error mapping role:', error);
        throw new Error(`Failed to map role: ${error.message}`);
    }
}

/**
 * Lambda handler
 */
export async function handler(event: RoleMappingRequest): Promise<any> {
    console.log('Event:', JSON.stringify(event, null, 2));

    const endpoint = process.env.OPENSEARCH_ENDPOINT;

    // Validate environment variables
    if (!endpoint) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'OPENSEARCH_ENDPOINT environment variable not set'
            })
        };
    }

    // Validate request
    if (!event.lambdaRoleArn) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: 'lambdaRoleArn is required in the request'
            })
        };
    }

    try {
        const client = createOpenSearchClient(endpoint);
        const result = await mapRoleToOpenSearch(
            client,
            event.lambdaRoleArn,
            event.opensearchRole
        );

        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };
    } catch (error: any) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to configure OpenSearch access',
                message: error.message
            })
        };
    }
}
