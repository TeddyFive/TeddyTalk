import boto3
import json
import os
from datetime import datetime, timedelta
from decimal import Decimal
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from langchain.output_parsers import PydanticOutputParser

dynamodb = boto3.resource('dynamodb')
daily_summary_table = dynamodb.Table(os.environ['DAILY_SUMMARY_TABLE_NAME'])
monthly_summary_table = dynamodb.Table(os.environ['MONTHLY_SUMMARY_TABLE_NAME'])
ssm = boto3.client('ssm')

PROCESS_ONLY_LAST_MONTH = os.environ.get('PROCESS_ONLY_LAST_MONTH', 'true').lower() == 'true'

class MonthlySummary(BaseModel):
    summary: str = Field(description=" A concise summary of the conversation content for that month")
    language_communication_explanation: str = Field(description="A brief 2-sentence explanation of language and communication development")
    language_communication_notable_words: str = Field(description="A list of 10 notable words frequently used during the month")
    cognitive_development_explanation: str = Field(description="A brief 2-sentence explanation of cognitive development")
    social_emotional_explanation: str = Field(description="A brief 2-sentence explanation of social and emotional development")

def get_openai_api_key():
    parameter_name = os.environ['OPENAI_API_KEY_PARAMETER_NAME']
    response = ssm.get_parameter(Name=parameter_name, WithDecryption=True)
    return response['Parameter']['Value']

def get_data_for_month(start_date, end_date):
    response = daily_summary_table.scan(
        FilterExpression='#date BETWEEN :start_date AND :end_date',
        ExpressionAttributeNames={'#date': 'date'},
        ExpressionAttributeValues={
            ':start_date': start_date,
            ':end_date': end_date
        }
    )
    return response['Items']

def calculate_average_scores(data):
    total_scores = {
        'language_communication_score': 0,
        'cognitive_development_score': 0,
        'social_emotional_score': 0,
    }
    count = len(data)

    for item in data:
        for score_type in total_scores.keys():
            total_scores[score_type] += item[score_type]

    return {score_type: total / count for score_type, total in total_scores.items()}

def decimal_to_float(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def generate_monthly_summary(data, average_scores, api_key):
    llm = ChatOpenAI(temperature=0.2, api_key=api_key)
    parser = PydanticOutputParser(pydantic_object=MonthlySummary)

    float_average_scores = json.loads(json.dumps(average_scores, default=decimal_to_float))

    prompt = ChatPromptTemplate.from_template(
        """
        Analyze the following monthly data and provide:
        1.  A concise summary of the conversation content for that month
        2. Brief explanations (2 sentences each) for the following aspects:
           - Language and communication development
           - Cognitive development
           - Social and emotional development
        3. A list of 10 most important and frequently used notable words during the month
           (Pay special attention to the 'language_communication_notable_words' field in each day's data.)

        Average scores for the month:
        {average_scores}

        Use this format:
        {format_instructions}

        Monthly data:
        {monthly_data}
        """
    )

    chain = prompt | llm | parser
    result = chain.invoke({
        "average_scores": json.dumps(float_average_scores, indent=2),
        "monthly_data": json.dumps(data, default=decimal_to_float, indent=2),
        "format_instructions": parser.get_format_instructions()
    })

    return result

def process_month(start_date, end_date, openai_api_key):
    month_data = get_data_for_month(start_date, end_date)
    print(f"Retrieved {len(month_data)} items for the period {start_date} to {end_date}")
    if not month_data:
        return None

    # Group data by user
    data_by_user = {}
    for item in month_data:
        user_id = item['userId']
        if user_id not in data_by_user:
            data_by_user[user_id] = []
        data_by_user[user_id].append(item)

    summaries = []
    for user_id, user_data in data_by_user.items():
        print(f"Processing data for user {user_id}")
        try:
            average_scores = calculate_average_scores(user_data)
            print(f"Average scores for user {user_id}: {average_scores}")
            monthly_summary = generate_monthly_summary(user_data, average_scores, openai_api_key)
            print(f"Generated monthly summary for user {user_id}")

            summary = {
                'userId': user_id,
                'month': start_date[:7],  # YYYY-MM
                'summary': monthly_summary.summary,
                'language_communication_score': Decimal(str(average_scores['language_communication_score'])),
                'language_communication_explanation': monthly_summary.language_communication_explanation,
                'language_communication_notable_words': monthly_summary.language_communication_notable_words,
                'cognitive_development_score': Decimal(str(average_scores['cognitive_development_score'])),
                'cognitive_development_explanation': monthly_summary.cognitive_development_explanation,
                'social_emotional_score': Decimal(str(average_scores['social_emotional_score'])),
                'social_emotional_explanation': monthly_summary.social_emotional_explanation,
            }
            summaries.append(summary)
            print(f"Added summary for user {user_id} to summaries list")
        except Exception as e:
            print(f"Error processing data for user {user_id}: {str(e)}")
            import traceback
            print(traceback.format_exc())

    return summaries

def lambda_handler(event, context):
    try:
        print("Starting monthly summary generation")
        openai_api_key = get_openai_api_key()

        if PROCESS_ONLY_LAST_MONTH:
            today = datetime.now()
            first_day_of_current_month = today.replace(day=1)
            last_day_of_previous_month = first_day_of_current_month - timedelta(days=1)
            first_day_of_previous_month = last_day_of_previous_month.replace(day=1)

            start_date = first_day_of_previous_month.strftime('%Y-%m-%d')
            end_date = last_day_of_previous_month.strftime('%Y-%m-%d')

            print(f"Processing last month: {start_date} to {end_date}")
            summaries = process_month(start_date, end_date, openai_api_key)
            if summaries:
                for summary in summaries:
                    print(f"Writing summary for user {summary['userId']} for month {summary['month']}")
                    monthly_summary_table.put_item(Item=summary)
            else:
                print("No summaries generated for the last month")
        else:
            # Process all months
            response = daily_summary_table.scan(
                ProjectionExpression='#date',
                ExpressionAttributeNames={'#date': 'date'},
                Limit=1
            )
            
            if not response['Items']:
                print("No data found in the daily summary table")
                return {
                    'statusCode': 200,
                    'body': json.dumps('No data to process')
                }
            
            earliest_date = min(item['date'] for item in response['Items'])

            current_date = datetime.now()
            start_date = datetime.strptime(earliest_date, '%Y-%m-%d').replace(day=1)

            while start_date < current_date:
                end_date = (start_date + timedelta(days=32)).replace(day=1) - timedelta(days=1)
                
                summaries = process_month(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'), openai_api_key)
                if summaries:
                    for summary in summaries:
                        monthly_summary_table.put_item(Item=summary)
                
                start_date = end_date + timedelta(days=1)

        print("Monthly summary generation completed successfully")
        return {
            'statusCode': 200,
            'body': json.dumps('Monthly summaries generated successfully')
        }
    except Exception as e:
        print(f"Error generating monthly summaries: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error generating monthly summaries: {str(e)}')
        }
