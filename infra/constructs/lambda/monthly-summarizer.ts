import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";
import * as path from "path";
import * as lambdaPython from "@aws-cdk/aws-lambda-python-alpha";
import * as cdk from "aws-cdk-lib";

export interface MonthlySummaryProcessorProps {
  dailySummaryTable: dynamodb.ITable;
  monthlySummaryTable: dynamodb.ITable;
  openAiApiKeyParameterName: string;
}

export class MonthlySummaryProcessor extends Construct {
  public readonly lambda: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: MonthlySummaryProcessorProps
  ) {
    super(scope, id);

    this.lambda = new lambdaPython.PythonFunction(
      this,
      "MonthlySummaryLambda",
      {
        entry: path.join(__dirname, "../../lambda-functions/monthly_summary"),
        runtime: lambda.Runtime.PYTHON_3_12,
        index: "index.py",
        handler: "lambda_handler",
        timeout: cdk.Duration.minutes(15),
        environment: {
          DAILY_SUMMARY_TABLE_NAME: props.dailySummaryTable.tableName,
          MONTHLY_SUMMARY_TABLE_NAME: props.monthlySummaryTable.tableName,
          OPENAI_API_KEY_PARAMETER_NAME: props.openAiApiKeyParameterName,
          PROCESS_ONLY_LAST_MONTH: "false",
        },
      }
    );

    this.lambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: ["*"],
      })
    );

    props.dailySummaryTable.grantReadData(this.lambda);
    props.monthlySummaryTable.grantWriteData(this.lambda);

    // Schedule monthly summary generation
    new events.Rule(this, "MonthlySummaryRule", {
      schedule: events.Schedule.cron({ day: "1", hour: "0", minute: "0" }),
      targets: [new targets.LambdaFunction(this.lambda)],
    });
  }
}
