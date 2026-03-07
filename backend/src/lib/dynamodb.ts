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

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-1',
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

function getRetryDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    INITIAL_DELAY_MS * Math.pow(2, attempt),
    MAX_DELAY_MS
  );
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, exponentialDelay + jitter);
}

function isRetryableError(error: any): boolean {
  const retryableCodes = [
    'ProvisionedThroughputExceededException',
    'ThrottlingException',
    'ServiceUnavailable',
    'InternalServerError',
  ];
  return error.name && retryableCodes.includes(error.name);
}

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

export async function executeTransaction(
  input: any,
  retries: number = DEFAULT_RETRIES
): Promise<void> {
  await executeWithRetry(
    () => docClient.send(new TransactWriteCommand(input)),
    retries
  );
}

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

export async function queryItems<T>(
  params: any
): Promise<T[]> {
  const result = await executeWithRetry(() =>
    docClient.send(new QueryCommand(params))
  );
  return (result.Items as T[]) || [];
}

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
