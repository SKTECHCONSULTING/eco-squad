import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';

// Import and re-export TransactWriteCommandInput type
import { TransactWriteCommandInput as OriginalTransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
export type TransactWriteCommandInput = OriginalTransactWriteCommandInput;

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-1',
  ...(process.env.DYNAMODB_ENDPOINT && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
  }),
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, TransactWriteCommand };

// Retry configuration
const DEFAULT_RETRIES = 3;
const INITIAL_DELAY_MS = 100;
const MAX_DELAY_MS = 2000;

/**
 * Calculate delay with exponential backoff and jitter
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    INITIAL_DELAY_MS * Math.pow(2, attempt),
    MAX_DELAY_MS
  );
  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, exponentialDelay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  const retryableCodes = [
    'ProvisionedThroughputExceededException',
    'ThrottlingException',
    'ServiceUnavailable',
    'InternalServerError',
  ];
  return (
    error.name && retryableCodes.includes(error.name)
  );
}

/**
 * Execute a DynamoDB command with retry logic
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  retries: number = DEFAULT_RETRIES
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      if (attempt === retries || !isRetryableError(error)) {
        throw error;
      }

      const delay = getRetryDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Execute a transaction with retry logic
 */
export async function executeTransaction(
  input: TransactWriteCommandInput,
  retries: number = DEFAULT_RETRIES
): Promise<void> {
  await executeWithRetry(
    () => docClient.send(new TransactWriteCommand(input)),
    retries
  );
}

/**
 * Get item with retry
 */
export async function getItem<T>(
  tableName: string,
  key: Record<string, any>
): Promise<T | null> {
  const result = await executeWithRetry(() =>
    docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: key,
      })
    )
  );
  return (result.Item as T) || null;
}

/**
 * Put item with retry
 */
export async function putItem(
  tableName: string,
  item: Record<string, any>,
  conditionExpression?: string
): Promise<void> {
  await executeWithRetry(() =>
    docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ...(conditionExpression && { ConditionExpression: conditionExpression }),
      })
    )
  );
}

/**
 * Query with retry
 */
export async function queryItems<T>(
  params: Omit<ConstructorParameters<typeof QueryCommand>[0], 'TableName'> & {
    TableName: string;
  }
): Promise<T[]> {
  const result = await executeWithRetry(() =>
    docClient.send(new QueryCommand(params))
  );
  return (result.Items as T[]) || [];
}

/**
 * Update item with retry
 */
export async function updateItem(
  tableName: string,
  key: Record<string, any>,
  updateExpression: string,
  expressionAttributeNames: Record<string, string>,
  expressionAttributeValues: Record<string, any>,
  conditionExpression?: string
): Promise<void> {
  await executeWithRetry(() =>
    docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ...(conditionExpression && { ConditionExpression: conditionExpression }),
      })
    )
  );
}

/**
 * Delete item with retry
 */
export async function deleteItem(
  tableName: string,
  key: Record<string, any>,
  conditionExpression?: string
): Promise<void> {
  await executeWithRetry(() =>
    docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: key,
        ...(conditionExpression && { ConditionExpression: conditionExpression }),
      })
    )
  );
}
