import os
import json
import csv
from pydantic import BaseModel, Field
from langchain.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

class SocialEmotionalEvaluation(BaseModel):
    estimated_age: float = Field(description="Estimated age level (3-7 years)")
    score: int = Field(description="Score (0-10 points, where 7 years old = 10 points, 3 years old = 0 points)")
    emotional_expression: str = Field(description="Ability to express and recognize emotions")
    social_interaction: str = Field(description="Quality of social interactions and relationships")
    self_regulation: str = Field(description="Ability to manage emotions and behavior")
    explanation: str = Field(description="Overall evaluation of social-emotional development")

def load_age_data():
    data = {}
    for age in range(3, 8):  # From 3 to 7 years old
        age_data = {}
        
        # Load milestones
        milestone_path = f'language_communication/{age}_year_old_milestones.csv'
        if os.path.exists(milestone_path):
            with open(milestone_path, 'r', newline='') as file:
                reader = csv.DictReader(file)
                age_data['milestones'] = list(reader)
        
        if age_data:
            data[age] = age_data
    
    return data

def evaluate(conversation_text, llm):
    age_data = load_age_data()

    parser = PydanticOutputParser(pydantic_object=SocialEmotionalEvaluation)

    prompt = ChatPromptTemplate.from_template(
        """
        As an evaluator, analyze the following conversation and assess the social and emotional development.

        Conversation:
        {conversation_text}

        Social-emotional development milestones for each age:
        {age_data}

        Evaluate the child's social-emotional development based on the conversation and provide:
        1. Estimated age level (3-7 years)
        2. Score (0-10 points, where 7 years old = 1 points, 3 years old = 0 points)
        3. Ability to express and recognize emotions
        4. Quality of social interactions and relationships
        5. Ability to manage emotions and behavior
        6. Overall evaluation of social-emotional development

        Use this format:
        {format_instructions}
        """
    )

    chain = prompt | llm | parser

    result = chain.invoke({
        "conversation_text": conversation_text,
        "age_data": json.dumps(age_data, ensure_ascii=False),
        "format_instructions": parser.get_format_instructions()
    })

    return result

def evaluate_social_emotional(conversation_text, llm):
    evaluation = evaluate(conversation_text, llm)
    return evaluation
