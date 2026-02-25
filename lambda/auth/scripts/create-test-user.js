/**
 * Script to create a test user in DynamoDB
 * Usage: node create-test-user.js <environment> <username> <password>
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function createTestUser(environment, username, password) {
    const tableName = `${environment}-chatbot-users`;
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
        PK: `USER#${username}`,
        SK: `USER#${username}`,
        userId,
        username,
        passwordHash,
        roles: ['user'],
        createdAt: Date.now(),
    };

    try {
        await docClient.send(
            new PutCommand({
                TableName: tableName,
                Item: user,
            })
        );

        console.log('✓ Test user created successfully!');
        console.log('');
        console.log('User Details:');
        console.log(`  Username: ${username}`);
        console.log(`  User ID: ${userId}`);
        console.log(`  Roles: ${user.roles.join(', ')}`);
        console.log('');
        console.log('You can now use these credentials to log in.');
    } catch (error) {
        console.error('Error creating test user:', error);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 3) {
    console.error('Usage: node create-test-user.js <environment> <username> <password>');
    console.error('Example: node create-test-user.js dev testuser mypassword123');
    process.exit(1);
}

const [environment, username, password] = args;

createTestUser(environment, username, password);
