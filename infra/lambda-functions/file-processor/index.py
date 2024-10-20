import json
import boto3
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import pytz
from pydantic import BaseModel, Field
from langchain.output_parsers import PydanticOutputParser

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
ssm = boto3.client('ssm')
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])

class ConversationSummary(BaseModel):
    summary_title: str = Field(description="A concise title of the summary")
    summary: str = Field(description="A concise summary of the conversations")

def get_openai_api_key():
    parameter_name = os.environ['OPENAI_API_KEY_PARAMETER_NAME']
    response = ssm.get_parameter(Name=parameter_name, WithDecryption=True)
    return response['Parameter']['Value']

def generate_summary(conversation, api_key):
    llm = ChatOpenAI(temperature=0, api_key=api_key)
    parser = PydanticOutputParser(pydantic_object=ConversationSummary)
    prompt = ChatPromptTemplate.from_template(
        """
        Summarize the following conversation concisely:
        1. A concise title of the summary
        2. A concise summary
        
        Use this format:
        {format_instructions}

        Please replace "User" with "Child". And please focus on the child's perspective.
        {conversation}
        """
    )
    
    chain = prompt | llm | parser
    result = chain.invoke({"conversation": json.dumps(conversation), "format_instructions": parser.get_format_instructions()})
    return result

def handler(event, context):
    try:
        openai_api_key = get_openai_api_key()
        
        for record in event['Records']:
            bucket = record['s3']['bucket']['name']
            key = record['s3']['object']['key']
            
            parts = key.split('/')
            user_id = parts[1]
            
            response = s3_client.get_object(Bucket=bucket, Key=key)
            conversation = json.loads(response['Body'].read().decode('utf-8'))

            simplified_conversation = []
            all_images = []
            for item in conversation:
                if item['type'] == 'message':
                    role = item['role']
                    content = item['content'][0]
                    text = content.get('text', '') or content.get('transcript', '')
                    simplified_conversation.append({"role": role, "text": text})
                
                if item['images']:
                    all_images.extend([{'url': img['url'], 'timestamp': img['timestamp']} for img in item['images']])

            result = generate_summary(simplified_conversation, openai_api_key)
            
            pacific_tz = pytz.timezone('US/Pacific')
            now = datetime.now(pacific_tz)
            timestamp = int(now.timestamp() * 1000)
            date = now.strftime('%Y-%m-%d')
            time = now.strftime('%H:%M:%S')
            
            item = {
                'userId': user_id,
                'timestamp': timestamp,
                'date': date,
                'time': time,
                'conversation': simplified_conversation,
                'summary': result.summary,
                'summary_title': result.summary_title,
                'Images': all_images
            }
            
            table.put_item(Item=item)
            
        return {
            'statusCode': 200,
            'body': json.dumps('File processing completed')
        }
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error processing file: {str(e)}')
        }
