import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import * as path from 'path';

export class EcoSquadStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly evidenceBucket: s3.Bucket;
  public readonly userPool: cognito.UserPool;
  public readonly verificationLambda: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Environment configuration
    const environment = process.env.ENVIRONMENT || 'dev';
    const appName = 'eco-squad';

    // Common tags for all resources
    const commonTags = {
      Application: appName,
      Environment: environment,
      ManagedBy: 'CDK',
      Project: 'EcoSquad',
    };

    // Apply tags to the stack (will be inherited by resources that support tags)
    Object.entries(commonTags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // ============================================================
    // DynamoDB Table
    // ============================================================
    this.table = new dynamodb.Table(this, 'EcoSquadTable', {
      tableName: `${appName}-${environment}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl', // TTL for mission expiration
    });

    // GSI for Geohash-based queries (location-based mission discovery)
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for status-based queries (finding available missions)
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ============================================================
    // S3 Bucket for Evidence Images
    // ============================================================
    this.evidenceBucket = new s3.Bucket(this, 'EvidenceBucket', {
      bucketName: `${appName}-evidence-${this.account}-${this.region}-${environment}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET, 
            s3.HttpMethods.PUT, 
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: process.env.CORS_ORIGINS?.split(',') || [
            'http://localhost:3000',
            'https://eco-squad.app',
          ],
          allowedHeaders: [
            'Authorization',
            'Content-Type',
            'x-amz-content-sha256',
            'x-amz-date',
          ],
          exposedHeaders: ['ETag', 'Content-Type'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
    });

    // ============================================================
    // Cognito User Pool
    // ============================================================
    this.userPool = new cognito.UserPool(this, 'EcoSquadUserPool', {
      userPoolName: `${appName}-${environment}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      customAttributes: {
        role: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 50,
          mutable: true,
        }),
        organizationId: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 100,
          mutable: true,
        }),
      },
    });

    // User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'EcoSquadWebClient', {
      userPool: this.userPool,
      userPoolClientName: `${appName}-web-${environment}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: process.env.OAUTH_CALLBACK_URLS?.split(',') || [
          'http://localhost:3000/auth/callback',
          'https://eco-squad.app/auth/callback',
        ],
        logoutUrls: process.env.OAUTH_LOGOUT_URLS?.split(',') || [
          'http://localhost:3000',
          'https://eco-squad.app',
        ],
      },
      preventUserExistenceErrors: true,
    });

    // ============================================================
    // Cognito Groups
    // ============================================================
    // Admins Group
    new cognito.CfnUserPoolGroup(this, 'AdminsGroup', {
      groupName: 'Admins',
      userPoolId: this.userPool.userPoolId,
      description: 'Platform administrators with full access',
      precedence: 1,
    });

    // Organizations Group
    new cognito.CfnUserPoolGroup(this, 'OrganizationsGroup', {
      groupName: 'Organizations',
      userPoolId: this.userPool.userPoolId,
      description: 'Environmental organizations that create missions',
      precedence: 2,
    });

    // Volunteers Group
    new cognito.CfnUserPoolGroup(this, 'VolunteersGroup', {
      groupName: 'Volunteers',
      userPoolId: this.userPool.userPoolId,
      description: 'Volunteer users who complete missions',
      precedence: 3,
    });

    // ============================================================
    // Verification Lambda
    // ============================================================
    const verificationLogGroup = new logs.LogGroup(this, 'VerificationLambdaLogs', {
      logGroupName: `/aws/lambda/${appName}-verification-${environment}`,
      retention: environment === 'prod' 
        ? logs.RetentionDays.ONE_MONTH 
        : logs.RetentionDays.ONE_WEEK,
    });

    this.verificationLambda = new lambda.Function(this, 'VerificationLambda', {
      functionName: `${appName}-verification-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/verification')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        TABLE_NAME: this.table.tableName,
        BUCKET_NAME: this.evidenceBucket.bucketName,
        ENVIRONMENT: environment,
        REKOGNITION_MIN_CONFIDENCE: process.env.REKOGNITION_MIN_CONFIDENCE || '70',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      logGroup: verificationLogGroup,
      tracing: lambda.Tracing.ACTIVE,
    });

    // Add S3 bucket notification trigger for verification Lambda
    this.evidenceBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.verificationLambda),
      { prefix: 'evidence/' }
    );

    // ============================================================
    // IAM Permissions (Least Privilege)
    // ============================================================

    // DynamoDB permissions for verification Lambda
    this.table.grantReadWriteData(this.verificationLambda);

    // S3 permissions for verification Lambda
    this.evidenceBucket.grantRead(this.verificationLambda);

    // Rekognition permissions for verification Lambda
    this.verificationLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'rekognition:DetectLabels',
          'rekognition:DetectModerationLabels',
        ],
        resources: ['*'], // Rekognition doesn't support resource-level permissions
        conditions: {
          StringEquals: {
            'aws:RequestedRegion': this.region,
          },
        },
      })
    );

    // CloudWatch logs permissions
    this.verificationLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [verificationLogGroup.logGroupArn],
      })
    );

    // X-Ray tracing permissions
    this.verificationLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
        ],
        resources: ['*'],
      })
    );

    // ============================================================
    // API Lambda (for Next.js API routes)
    // ============================================================
    const apiLogGroup = new logs.LogGroup(this, 'ApiLambdaLogs', {
      logGroupName: `/aws/lambda/${appName}-api-${environment}`,
      retention: environment === 'prod' 
        ? logs.RetentionDays.ONE_MONTH 
        : logs.RetentionDays.ONE_WEEK,
    });

    const apiLambda = new lambda.Function(this, 'ApiLambda', {
      functionName: `${appName}-api-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'API placeholder - replace with actual Next.js build' }),
          };
        };
      `),
      timeout: cdk.Duration.seconds(10),
      memorySize: 1024,
      environment: {
        TABLE_NAME: this.table.tableName,
        BUCKET_NAME: this.evidenceBucket.bucketName,
        USER_POOL_ID: this.userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        ENVIRONMENT: environment,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      logGroup: apiLogGroup,
      tracing: lambda.Tracing.ACTIVE,
    });

    // API Lambda permissions
    this.table.grantReadWriteData(apiLambda);
    this.evidenceBucket.grantReadWrite(apiLambda);

    // ============================================================
    // CloudWatch Alarms
    // ============================================================
    new cloudwatch.Alarm(this, 'VerificationErrorsAlarm', {
      alarmName: `${appName}-verification-errors-${environment}`,
      alarmDescription: 'Alarm when verification Lambda has errors',
      metric: this.verificationLambda.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ============================================================
    // Outputs
    // ============================================================
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB Table Name',
      exportName: `${appName}-table-name-${environment}`,
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB Table ARN',
      exportName: `${appName}-table-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.evidenceBucket.bucketName,
      description: 'S3 Evidence Bucket Name',
      exportName: `${appName}-bucket-name-${environment}`,
    });

    new cdk.CfnOutput(this, 'BucketArn', {
      value: this.evidenceBucket.bucketArn,
      description: 'S3 Evidence Bucket ARN',
      exportName: `${appName}-bucket-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${appName}-user-pool-id-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${appName}-user-pool-client-id-${environment}`,
    });

    new cdk.CfnOutput(this, 'VerificationLambdaArn', {
      value: this.verificationLambda.functionArn,
      description: 'Verification Lambda ARN',
      exportName: `${appName}-verification-lambda-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'ApiLambdaArn', {
      value: apiLambda.functionArn,
      description: 'API Lambda ARN',
      exportName: `${appName}-api-lambda-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
      exportName: `${appName}-region-${environment}`,
    });
  }
}
