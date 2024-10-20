import os
import json
import csv
from pydantic import BaseModel, Field
from langchain.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate

class LanguageCommunicationEvaluation(BaseModel):
    estimated_age: float = Field(description="Estimated age level (3-7 years)")
    score: int = Field(description="Score (0-10 points, where 7 years old = 10 points, 3 years old = 0 points)")
    notable_words: str = Field(description="Exactly top 10 notable words used, excluding common greetings")
    sentence_structure: str = Field(description="Sentence structure characteristics")
    explanation: str = Field(description="Overall evaluation comment")

def load_age_data():
    data = {}
    for age in range(3, 8):  # From 3 to 7 years old
        age_data = {}
        
        # Load criteria
        criteria_path = f'language_communication/{age}_years_criteria.csv'
        if os.path.exists(criteria_path):
            with open(criteria_path, 'r', newline='') as file:
                reader = csv.DictReader(file)
                age_data['criteria'] = list(reader)
        
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

    parser = PydanticOutputParser(pydantic_object=LanguageCommunicationEvaluation)

    prompt = ChatPromptTemplate.from_template(
        """
        As an evaluator, analyze the following conversation and assess the language and communication skills.

        Conversation:
        {conversation_text}

        Language development criteria and milestones for each age:
        {age_data}
        
        When listing notable words:
          - Provide exactly 10 words.
          - Exclude common greetings like "hi", "hello", "bye", etc.
          - Focus on words that demonstrate the child's vocabulary and language development.
          - Return the words as a comma-separated string (e.g., "word1,word2,word3,word4,word5,word6,word7,word8,word9,word10")

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

def evaluate_language_communication(conversation_text, llm):
    return evaluate(conversation_text, llm)
