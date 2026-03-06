import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { EcoSquadStack } from '../lib/eco-squad-stack';

describe('EcoSquadStack', () => {
  let app: cdk.App;
  let stack: EcoSquadStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new EcoSquadStack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'eu-west-1',
      },
    });
    template = Template.fromStack(stack);
  });

  describe('DynamoDB Table', () => {
    it('should create a DynamoDB table with correct configuration', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: Match.stringLikeRegexp('eco-squad-.*'),
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
          { AttributeName: 'GSI1PK', AttributeType: 'S' },
          { AttributeName: 'GSI1SK', AttributeType: 'S' },
          { AttributeName: 'status', AttributeType: 'S' },
          { AttributeName: 'createdAt', AttributeType: 'S' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true,
        },
      });
    });

    it('should have GSI1 for geohash queries', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          }),
        ]),
      });
    });

    it('should have GSI2 for status-based queries', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'GSI2',
            KeySchema: [
              { AttributeName: 'status', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          }),
        ]),
      });
    });
  });

  describe('S3 Bucket', () => {
    it('should create an S3 bucket with correct configuration', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: Match.stringLikeRegexp('eco-squad-evidence-.*'),
        VersioningConfiguration: {
          Status: 'Enabled',
        },
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            },
          ],
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    it('should have CORS configuration', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        CorsConfiguration: {
          CorsRules: Match.arrayWith([
            Match.objectLike({
              AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
              AllowedHeaders: Match.arrayWith([
                'Authorization',
                'Content-Type',
              ]),
              ExposedHeaders: ['ETag', 'Content-Type'],
            }),
          ]),
        },
      });
    });

    it('should have lifecycle rules for archival', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Transitions: Match.arrayWith([
                Match.objectLike({
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 90,
                }),
                Match.objectLike({
                  StorageClass: 'GLACIER',
                  TransitionInDays: 365,
                }),
              ]),
            }),
          ]),
        },
      });
    });
  });

  describe('Cognito User Pool', () => {
    it('should create a Cognito User Pool', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: Match.stringLikeRegexp('eco-squad-.*'),
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
        },
        AutoVerifiedAttributes: ['email'],
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
            RequireLowercase: true,
            RequireNumbers: true,
            RequireSymbols: false,
            RequireUppercase: true,
          },
        },
        UsernameAttributes: ['email'],
        AccountRecoverySetting: {
          RecoveryMechanisms: [
            {
              Name: 'verified_email',
              Priority: 1,
            },
          ],
        },
      });
    });

    it('should have custom attributes', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Schema: Match.arrayWith([
          Match.objectLike({
            Name: 'role',
            Mutable: true,
          }),
          Match.objectLike({
            Name: 'organizationId',
            Mutable: true,
          }),
        ]),
      });
    });

    it('should create a User Pool Client', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ClientName: Match.stringLikeRegexp('eco-squad-web-.*'),
        ExplicitAuthFlows: Match.arrayWith([
          'ALLOW_USER_PASSWORD_AUTH',
          'ALLOW_USER_SRP_AUTH',
          'ALLOW_REFRESH_TOKEN_AUTH',
        ]),
        PreventUserExistenceErrors: 'ENABLED',
      });
    });
  });

  describe('Cognito Groups', () => {
    it('should create Admins group', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
        GroupName: 'Admins',
        Description: 'Platform administrators with full access',
        Precedence: 1,
      });
    });

    it('should create Organizations group', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
        GroupName: 'Organizations',
        Description: 'Environmental organizations that create missions',
        Precedence: 2,
      });
    });

    it('should create Volunteers group', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
        GroupName: 'Volunteers',
        Description: 'Volunteer users who complete missions',
        Precedence: 3,
      });
    });
  });

  describe('Lambda Functions', () => {
    it('should create verification Lambda', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: Match.stringLikeRegexp('eco-squad-verification-.*'),
        Runtime: 'nodejs20.x',
        Handler: 'index.handler',
        Timeout: 30,
        MemorySize: 512,
        Environment: {
          Variables: {
            TABLE_NAME: Match.anyValue(),
            BUCKET_NAME: Match.anyValue(),
            AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
          },
        },
        TracingConfig: {
          Mode: 'Active',
        },
      });
    });

    it('should create API Lambda', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: Match.stringLikeRegexp('eco-squad-api-.*'),
        Runtime: 'nodejs20.x',
        Handler: 'index.handler',
        Timeout: 10,
        MemorySize: 1024,
        TracingConfig: {
          Mode: 'Active',
        },
      });
    });
  });

  describe('S3 Notifications', () => {
    it('should create S3 notification for Lambda trigger', () => {
      template.hasResourceProperties('Custom::S3BucketNotifications', {
        NotificationConfiguration: {
          LambdaFunctionConfigurations: Match.arrayWith([
            Match.objectLike({
              Events: ['s3:ObjectCreated:*'],
              Filter: {
                Key: {
                  FilterRules: [
                    {
                      Name: 'prefix',
                      Value: 'evidence/',
                    },
                  ],
                },
              },
            }),
          ]),
        },
      });
    });

    it('should create Lambda permission for S3 trigger', () => {
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        Principal: 's3.amazonaws.com',
      });
    });
  });

  describe('IAM Policies', () => {
    it('should grant DynamoDB read/write to verification Lambda', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Action: Match.arrayWith([
                'dynamodb:GetItem',
                'dynamodb:UpdateItem',
              ]),
            }),
          ]),
        },
      });
    });

    it('should grant Rekognition permissions to verification Lambda', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Action: [
                'rekognition:DetectLabels',
                'rekognition:DetectModerationLabels',
              ],
            }),
          ]),
        },
      });
    });

    it('should grant S3 read access to verification Lambda', () => {
      // Find the verification lambda policy
      const policies = template.findResources('AWS::IAM::Policy');
      const verificationPolicy = Object.values(policies).find((policy: any) =>
        policy.Properties.PolicyName?.includes('VerificationLambda')
      );
      
      expect(verificationPolicy).toBeDefined();
      const statements = (verificationPolicy as any).Properties.PolicyDocument.Statement;
      const s3Statement = statements.find((s: any) => 
        s.Action && JSON.stringify(s.Action).includes('s3:Get')
      );
      expect(s3Statement).toBeDefined();
      expect(s3Statement.Effect).toBe('Allow');
    });
  });

  describe('CloudWatch Logs', () => {
    it('should create log groups for Lambda functions', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: Match.stringLikeRegexp('/aws/lambda/eco-squad-.*'),
      });
    });
  });

  describe('CloudWatch Alarms', () => {
    it('should create error alarm for verification Lambda', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: Match.stringLikeRegexp('eco-squad-verification-errors-.*'),
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        Statistic: 'Sum',
        Period: 300,
        EvaluationPeriods: 1,
        Threshold: 5,
        ComparisonOperator: Match.stringLikeRegexp('GreaterThan.*'),
        TreatMissingData: 'notBreaching',
      });
    });
  });

  describe('Outputs', () => {
    it('should output TableName', () => {
      template.hasOutput('TableName', {
        Export: {
          Name: Match.stringLikeRegexp('eco-squad-table-name-.*'),
        },
      });
    });

    it('should output BucketName', () => {
      template.hasOutput('BucketName', {
        Export: {
          Name: Match.stringLikeRegexp('eco-squad-bucket-name-.*'),
        },
      });
    });

    it('should output UserPoolId', () => {
      template.hasOutput('UserPoolId', {
        Export: {
          Name: Match.stringLikeRegexp('eco-squad-user-pool-id-.*'),
        },
      });
    });
  });
});
