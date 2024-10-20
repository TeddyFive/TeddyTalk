import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import * as path from "path";
import * as lambdaPython from "@aws-cdk/aws-lambda-python-alpha";
import * as cdk from "aws-cdk-lib";

export interface DailySummaryProcessorProps {
  conversationTable: dynamodb.ITable;
  dailySummaryTable: dynamodb.ITable;
  openAiApiKeyParameterName: string;
}

export class DailySummaryProcessor extends Construct {
  public readonly lambda: lambda.Function;

  constructor(scope: Construct, id: string, props: DailySummaryProcessorProps) {
    super(scope, id);

    this.lambda = new lambdaPython.PythonFunction(this, "DailySummaryLambda", {
      entry: path.join(__dirname, "../../lambda-functions/daily_summary"),
      runtime: lambda.Runtime.PYTHON_3_12,
      index: "index.py",
      handler: "lambda_handler",
      timeout: cdk.Duration.minutes(15),
      environment: {
        CONVERSATION_TABLE_NAME: props.conversationTable.tableName,
        DAILY_SUMMARY_TABLE_NAME: props.dailySummaryTable.tableName,
        OPENAI_API_KEY_PARAMETER_NAME: props.openAiApiKeyParameterName,
        PROCESS_ONLY_YESTERDAY: "false",
      },
    });

    this.lambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: ["*"],
      })
    );

    props.conversationTable.grantReadData(this.lambda);
    props.dailySummaryTable.grantWriteData(this.lambda);

    // Schedule daily summary generation
    // new events.Rule(this, 'DailySummaryRule', {
    //   schedule: events.Schedule.cron({ minute: '0', hour: '1' }),
    //   targets: [new targets.LambdaFunction(this.lambda)],
    // });
  }
}
