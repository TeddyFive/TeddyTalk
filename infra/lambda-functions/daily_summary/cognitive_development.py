import os
import json
import csv
from pydantic import BaseModel, Field
from langchain.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate

class CognitiveDevelopmentEvaluation(BaseModel):
    estimated_age: float = Field(description="Estimated age level (3-7 years)")
    score: int = Field(description="Score (0-10 points, where 7 years old = 1 points, 3 years old = 0 points)")
    problem_solving: str = Field(description="Problem-solving skills demonstrated")
    memory_skills: str = Field(description="Memory skills observed")
    conceptual_understanding: str = Field(description="Level of conceptual understanding")
    explanation: str = Field(description="Overall evaluation of cognitive development")

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

    parser = PydanticOutputParser(pydantic_object=CognitiveDevelopmentEvaluation)

    prompt = ChatPromptTemplate.from_template(
        """
        As an evaluator, analyze the following conversation and assess the cognitive development skills.

        Conversation:
        {conversation_text}

        Cognitive development milestones for each age:
        {age_data}

        Evaluate the child's cognitive development based on the conversation and provide:
        1. Estimated age level (3-7 years)
        2. Score (0-10 points, where 7 years old = 10 points, 3 years old = 0 points)
        3. Problem-solving skills demonstrated
        4. Memory skills observed
        5. Level of conceptual understanding
        6. Overall evaluation of cognitive development

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

def evaluate_cognitive_development(conversation_text, llm):
    evaluation = evaluate(conversation_text, llm)
    return evaluation
