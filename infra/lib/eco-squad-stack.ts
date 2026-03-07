import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import * as path from 'path';

export class EcoSquadStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly evidenceBucket: s3.Bucket;
  public readonly userPool: cognito.UserPool;
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Environment configuration
    const environment = process.env.ENVIRONMENT || 'dev';
    const appName = 'eco-squad';

    // Common tags
    const commonTags = {
      Application: appName,
      Environment: environment,
      ManagedBy: 'CDK',
      Project: 'EcoSquad',
    };

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
      timeToLiveAttribute: 'ttl',
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

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
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.HEAD],
          allowedOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
          allowedHeaders: ['Authorization', 'Content-Type', 'x-amz-content-sha256', 'x-amz-date'],
          exposedHeaders: ['ETag', 'Content-Type'],
          maxAge: 3000,
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
        role: new cognito.StringAttribute({ minLen: 1, maxLen: 50, mutable: true }),
        organizationId: new cognito.StringAttribute({ minLen: 1, maxLen: 100, mutable: true }),
      },
    });

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
        callbackUrls: process.env.OAUTH_CALLBACK_URLS?.split(',') || ['http://localhost:3000/auth/callback'],
        logoutUrls: process.env.OAUTH_LOGOUT_URLS?.split(',') || ['http://localhost:3000'],
      },
      preventUserExistenceErrors: true,
    });

    // Cognito Groups
    new cognito.CfnUserPoolGroup(this, 'AdminsGroup', {
      groupName: 'Admins',
      userPoolId: this.userPool.userPoolId,
      description: 'Platform administrators with full access',
      precedence: 1,
    });

    new cognito.CfnUserPoolGroup(this, 'OrganizationsGroup', {
      groupName: 'Organizations',
      userPoolId: this.userPool.userPoolId,
      description: 'Environmental organizations that create missions',
      precedence: 2,
    });

    new cognito.CfnUserPoolGroup(this, 'VolunteersGroup', {
      groupName: 'Volunteers',
      userPoolId: this.userPool.userPoolId,
      description: 'Volunteer users who complete missions',
      precedence: 3,
    });

    // ============================================================
    // Lambda Functions
    // ============================================================
    const lambdaEnvironment = {
      TABLE_NAME: this.table.tableName,
      BUCKET_NAME: this.evidenceBucket.bucketName,
      USER_POOL_ID: this.userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      ENVIRONMENT: environment,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    };

    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: lambdaEnvironment,
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2020',
      },
    };

    // Missions Lambda Functions
    const missionsListHandler = new lambdaNodejs.NodejsFunction(this, 'MissionsListHandler', {
      entry: path.join(__dirname, '../../backend/src/functions/missions/index.ts'),
      handler: 'handler',
      functionName: `${appName}-missions-list-${environment}`,
      ...commonLambdaProps,
    });

    const missionsDetailHandler = new lambdaNodejs.NodejsFunction(this, 'MissionsDetailHandler', {
      entry: path.join(__dirname, '../../backend/src/functions/missions/[id].ts'),
      handler: 'handler',
      functionName: `${appName}-missions-detail-${environment}`,
      ...commonLambdaProps,
    });

    const missionsClaimHandler = new lambdaNodejs.NodejsFunction(this, 'MissionsClaimHandler', {
      entry: path.join(__dirname, '../../backend/src/functions/missions/claim.ts'),
      handler: 'handler',
      functionName: `${appName}-missions-claim-${environment}`,
      ...commonLambdaProps,
    });

    const missionsSubmitHandler = new lambdaNodejs.NodejsFunction(this, 'MissionsSubmitHandler', {
      entry: path.join(__dirname, '../../backend/src/functions/missions/submit-evidence.ts'),
      handler: 'handler',
      functionName: `${appName}-missions-submit-${environment}`,
      ...commonLambdaProps,
    });

    // Squads Lambda Functions
    const squadsListHandler = new lambdaNodejs.NodejsFunction(this, 'SquadsListHandler', {
      entry: path.join(__dirname, '../../backend/src/functions/squads/index.ts'),
      handler: 'handler',
      functionName: `${appName}-squads-list-${environment}`,
      ...commonLambdaProps,
    });

    const squadsDetailHandler = new lambdaNodejs.NodejsFunction(this, 'SquadsDetailHandler', {
      entry: path.join(__dirname, '../../backend/src/functions/squads/[id].ts'),
      handler: 'handler',
      functionName: `${appName}-squads-detail-${environment}`,
      ...commonLambdaProps,
    });

    const squadsMembersHandler = new lambdaNodejs.NodejsFunction(this, 'SquadsMembersHandler', {
      entry: path.join(__dirname, '../../backend/src/functions/squads/members.ts'),
      handler: 'handler',
      functionName: `${appName}-squads-members-${environment}`,
      ...commonLambdaProps,
    });

    // Grant permissions
    this.table.grantReadWriteData(missionsListHandler);
    this.table.grantReadWriteData(missionsDetailHandler);
    this.table.grantReadWriteData(missionsClaimHandler);
    this.table.grantReadWriteData(missionsSubmitHandler);
    this.table.grantReadWriteData(squadsListHandler);
    this.table.grantReadWriteData(squadsDetailHandler);
    this.table.grantReadWriteData(squadsMembersHandler);

    // ============================================================
    // API Gateway with Cognito Authorizer
    // ============================================================
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [this.userPool],
      authorizerName: `${appName}-authorizer-${environment}`,
    });

    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
      logGroupName: `/aws/apigateway/${appName}-${environment}`,
      retention: environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    });

    this.api = new apigateway.RestApi(this, 'EcoSquadApi', {
      restApiName: `${appName}-api-${environment}`,
      deployOptions: {
        stageName: environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.clf(),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key'],
      },
    });

    // API Resources and Methods
    const missionsResource = this.api.root.addResource('missions');
    const missionResource = missionsResource.addResource('{id}');
    const claimResource = missionResource.addResource('claim');
    const submitResource = missionResource.addResource('submit-evidence');

    const squadsResource = this.api.root.addResource('squads');
    const squadResource = squadsResource.addResource('{id}');
    const membersResource = squadResource.addResource('members');
    const memberResource = membersResource.addResource('{userId}');

    // Helper function to create method options with auth
    const publicMethod = { methodResponses: [{ statusCode: '200' }] };
    const protectedMethod = {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      methodResponses: [{ statusCode: '200' }],
    };

    // Missions endpoints
    missionsResource.addMethod('GET', new apigateway.LambdaIntegration(missionsListHandler), publicMethod);
    missionsResource.addMethod('POST', new apigateway.LambdaIntegration(missionsListHandler), protectedMethod);
    
    missionResource.addMethod('GET', new apigateway.LambdaIntegration(missionsDetailHandler), publicMethod);
    missionResource.addMethod('PATCH', new apigateway.LambdaIntegration(missionsDetailHandler), protectedMethod);
    missionResource.addMethod('DELETE', new apigateway.LambdaIntegration(missionsDetailHandler), protectedMethod);
    
    claimResource.addMethod('POST', new apigateway.LambdaIntegration(missionsClaimHandler), protectedMethod);
    submitResource.addMethod('POST', new apigateway.LambdaIntegration(missionsSubmitHandler), protectedMethod);

    // Squads endpoints
    squadsResource.addMethod('GET', new apigateway.LambdaIntegration(squadsListHandler), publicMethod);
    squadsResource.addMethod('POST', new apigateway.LambdaIntegration(squadsListHandler), protectedMethod);
    
    squadResource.addMethod('GET', new apigateway.LambdaIntegration(squadsDetailHandler), publicMethod);
    squadResource.addMethod('PATCH', new apigateway.LambdaIntegration(squadsDetailHandler), protectedMethod);
    squadResource.addMethod('DELETE', new apigateway.LambdaIntegration(squadsDetailHandler), protectedMethod);
    
    membersResource.addMethod('GET', new apigateway.LambdaIntegration(squadsMembersHandler), publicMethod);
    membersResource.addMethod('POST', new apigateway.LambdaIntegration(squadsMembersHandler), protectedMethod);
    memberResource.addMethod('DELETE', new apigateway.LambdaIntegration(squadsMembersHandler), protectedMethod);

    // ============================================================
    // S3 Static Website Bucket
    // ============================================================
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `${appName}-website-${this.account}-${environment}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
    });

    // ============================================================
    // CloudFront Distribution
    // ============================================================
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI');
    this.websiteBucket.grantRead(originAccessIdentity);

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(this.websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
    });

    // ============================================================
    // CloudWatch Alarms
    // ============================================================
    new cloudwatch.Alarm(this, 'Api5xxErrors', {
      metric: this.api.metricServerError(),
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
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.evidenceBucket.bucketName,
      description: 'S3 Evidence Bucket Name',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'S3 Website Bucket Name',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });
  }
}
