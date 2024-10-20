import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { IoTConstruct } from '../constructs/iot';
import { FileProcessor } from '../constructs/lambda/file-processor';
import { DailySummaryProcessor } from '../constructs/lambda/daily-summarizer';
import { MonthlySummaryProcessor } from '../constructs/lambda/monthly-summarizer';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new IoTConstruct(this, 'IoTResources');

    const bucket = new s3.Bucket(this, 'FileUploadBucket', {
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    })

    const imageBucket = new s3.Bucket(this, 'ImageUploadBucket', {
      cors: [
            {
              allowedMethods: [
                s3.HttpMethods.GET,
                s3.HttpMethods.POST,
                s3.HttpMethods.PUT,
              ],
              allowedOrigins: ['*'],
              allowedHeaders: ['*'],
            },
          ],
        });

    // DynamoDB Tables
    const conversationTable = new dynamodb.Table(this, 'ConversationTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    conversationTable.addGlobalSecondaryIndex({
      indexName: 'DateIndex',
      partitionKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
    });

    const dailySummaryTable = new dynamodb.Table(this, 'DailySummaryTable', {
      partitionKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const monthlySummaryTable = new dynamodb.Table(this, 'MonthlySummaryTable', {
      partitionKey: { name: 'month', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const userNGWordsTable = new dynamodb.Table(this, 'UserNGWordsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Functions
    new FileProcessor(this, 'FileProcessor', {
      bucket: bucket,
      table: conversationTable,
      openAiApiKeyParameterName: 'openAiApiKey', 
    });

    new DailySummaryProcessor(this, 'DailySummaryProcessor', {
      conversationTable: conversationTable,
      dailySummaryTable: dailySummaryTable,
      openAiApiKeyParameterName: 'openAiApiKey',
    }); 

    new MonthlySummaryProcessor(this, 'MonthlySummaryProcessor', {
      dailySummaryTable: dailySummaryTable,
      monthlySummaryTable: monthlySummaryTable,
      openAiApiKeyParameterName: 'openAiApiKey',
    });

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 Bucket Name for File Uploads',
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: conversationTable.tableName,
      description: 'DynamoDB Table Name for File Info',
    });

    // Add output for UserTable
    new cdk.CfnOutput(this, 'UserNGWordsTableName', {
      value: userNGWordsTable.tableName,
      description: 'DynamoDB Table Name for userNGWordsTable Info',
    });
  }
}
