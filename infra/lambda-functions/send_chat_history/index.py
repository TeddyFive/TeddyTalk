import json
import logging
import boto3
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])

def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    logger.info(f"Context: {str(context)}")
    
    try:
        # Prepare the item to be inserted into DynamoDB
        item = {
            'user_id': event['user_id'],
            'timestamp': event['timestmp'],
            'chat_history': json.dumps(event['chat_history']),
        }
        
        # Write the item to DynamoDB
        table.put_item(Item=item)
        
        return {
            'statusCode': 200,
            'body': json.dumps('Chat history processed and stored successfully')
        }
    except Exception as e:
        logger.error(f"Error processing chat history: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps('Error processing chat history')
        }
