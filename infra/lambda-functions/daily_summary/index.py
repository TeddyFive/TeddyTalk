import boto3
import os
from datetime import datetime, timedelta
from langchain_openai import ChatOpenAI
from daily_summary import daily_summary
from language_communication import evaluate_language_communication
from cognitive_development import evaluate_cognitive_development
from social_emotional import evaluate_social_emotional

dynamodb = boto3.resource('dynamodb')
conversation_table = dynamodb.Table(os.environ['CONVERSATION_TABLE_NAME'])
daily_summary_table = dynamodb.Table(os.environ['DAILY_SUMMARY_TABLE_NAME'])
ssm = boto3.client('ssm')

def get_openai_api_key():
    parameter_name = os.environ['OPENAI_API_KEY_PARAMETER_NAME']
    response = ssm.get_parameter(Name=parameter_name, WithDecryption=True)
    return response['Parameter']['Value']

def get_dates_to_process():
    only_yesterday = os.environ.get('PROCESS_ONLY_YESTERDAY', 'false').lower() == 'true'
    if only_yesterday:
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        return [yesterday]
    else:
        # Get all unique dates from the conversation table
        response = conversation_table.scan(
            ProjectionExpression='#date',
            ExpressionAttributeNames={'#date': 'date'}
        )
        dates = set(item['date'] for item in response['Items'])
        while 'LastEvaluatedKey' in response:
            response = conversation_table.scan(
                ProjectionExpression='#date',
                ExpressionAttributeNames={'#date': 'date'},
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            dates.update(item['date'] for item in response['Items'])
        return sorted(list(dates))

def lambda_handler(event, context):
    try:
        openai_api_key = get_openai_api_key()
        llm = ChatOpenAI(temperature=0.2, api_key=openai_api_key)
        dates_to_process = get_dates_to_process()
        
        for date in dates_to_process:
            # Query DynamoDB for conversations on this date
            response = conversation_table.query(
                IndexName='DateIndex',
                KeyConditionExpression='#date = :date',
                ExpressionAttributeNames={'#date': 'date'},
                ExpressionAttributeValues={':date': date}
            )
            
            if not response['Items']:
                print(f"No conversations found for {date}")
                continue
            
            # Combine all conversations for the day
            all_conversations = []
            for item in response['Items']:
                all_conversations.extend(item['conversation'])
            
            # Evaluate conversations
            summary=daily_summary(all_conversations, llm)
            language_communication = evaluate_language_communication(all_conversations, llm)
            ognitive_development = evaluate_cognitive_development(all_conversations, llm)
            social_emotional = evaluate_social_emotional(all_conversations, llm)

            # Store evaluation results in the daily summary table
            daily_summary_table.put_item(
                Item={
                    'userId': item['userId'],
                    'timestamp': int(datetime.now().timestamp()),
                    'date': date,
                    'summary': summary.summary,
                    'summary_title': summary.summary_title,
                    'language_communication_score': language_communication.score,
                    'language_communication_explanation': language_communication.explanation,
                    'language_communication_notable_words': language_communication.notable_words,
                    'language_communication_sentence_structure': language_communication.sentence_structure,
                    'cognitive_development_score': ognitive_development.score,
                    'cognitive_development_explanation': ognitive_development.explanation,
                    'cognitive_development_problem_solving': ognitive_development.problem_solving,
                    'cognitive_development_conceptual_understanding': ognitive_development.conceptual_understanding,
                    'social_emotional_score': social_emotional.score,
                    'social_emotional_explanation': social_emotional.explanation,
                    'social_emotional_emotional_expression': social_emotional.emotional_expression,
                    'social_emotional_social_interaction': social_emotional.social_interaction,
                }
            )
            
            print(f"Daily summary for {date} generated and stored successfully")
        
    except Exception as e:
        print(f"Error generating daily summary: {str(e)}")
        raise e
