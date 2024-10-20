import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';

export interface FileProcessorProps {
  bucket: s3.IBucket;
  table: dynamodb.ITable;
  openAiApiKeyParameterName: string;
}

export class FileProcessor extends Construct {
  public readonly lambda: lambda.Function;

  constructor(scope: Construct, id: string, props: FileProcessorProps) {
    super(scope, id);

    this.lambda = new lambdaPython.PythonFunction(this, 'FileProcessorLambda', {
      entry: path.join(__dirname, '../../lambda-functions/file-processor'),
      runtime: lambda.Runtime.PYTHON_3_12,
      index: 'index.py',
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      environment: {
        DYNAMODB_TABLE_NAME: props.table.tableName,
        OPENAI_API_KEY_PARAMETER_NAME: props.openAiApiKeyParameterName,
      },
    });

    this.lambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: ['*'],
    }));

    props.bucket.grantRead(this.lambda);
    props.table.grantWriteData(this.lambda);

    props.bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.lambda)
    );
  }
}
