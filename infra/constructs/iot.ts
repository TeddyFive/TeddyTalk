import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';

export class IoTConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const certArn = process.env.IOT_CERTIFICATE_ARN;
    if (!certArn) {
      throw new Error('IOT_CERTIFICATE_ARN environment variable is not set');
    }

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    const topicName = 'raspberrypi/chat_history/topic';

    const thing = new iot.CfnThing(this, 'TeddyTalk', {
      thingName: 'teddytalk-thing',
    });

    const thingPrincipalAttachment = new iot.CfnThingPrincipalAttachment(this, 'AttachCertificateToMyThing', {
      principal: certArn,
      thingName: thing.thingName!,
    });

    const policy = new iot.CfnPolicy(this, 'IotPolicy', {
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "iot:Connect"
            ],
            Resource: [
              `arn:aws:iot:${region}:${accountId}:client/*`
            ]
          },
          {
            Effect: "Allow",
            Action: [
              "iot:Publish",
              "iot:Receive"
            ],
            Resource: [
              `arn:aws:iot:${region}:${accountId}:topic/${topicName}`
            ]
          },
          {
            Effect: "Allow",
            Action: [
              "iot:Subscribe"
            ],
            Resource: [
              `arn:aws:iot:${region}:${accountId}:topicfilter/${topicName}`
            ]
          }
        ]
      },
      policyName: 'iot-policy',
    });

    const policyPrincipalAttachment = new iot.CfnPolicyPrincipalAttachment(this, 'AttachCertificateToPolicy', {
      policyName: policy.policyName!,
      principal: certArn,
    });

    thingPrincipalAttachment.addDependency(thing);
    policyPrincipalAttachment.addDependency(policy);

    const sendChatHistoryFunction = new lambda.Function(this, 'SendChatHistoryFunction', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-functions/send_chat_history')),
      handler: 'send_chat_history.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_12,
      functionName: 'send-chat-history-function'
    });

    const topicRule = new iot.CfnTopicRule(this, 'TopicRule', {
      topicRulePayload: {
        actions: [
          {
            lambda: {
              functionArn: sendChatHistoryFunction.functionArn,
            },
          },
        ],
        sql: `SELECT * FROM '${topicName}'`,
        awsIotSqlVersion: '2016-03-23',
      },
      ruleName: 'send_chat_history_topic_rule',
    });

    sendChatHistoryFunction.addPermission('AddIotTopicRuleTrigger', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn: topicRule.attrArn,
    });
  }
}
