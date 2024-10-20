from pydantic import BaseModel, Field
from langchain.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate

class DailySummary(BaseModel):
    summary_title: str = Field(description="A concise title of the summary")
    summary: str = Field(description="A concise summary of the conversations")

def summary(conversations, llm):
    conversation_text = "\n".join([f"User: {conv['text']}" if conv['role'] == 'user' else f"Assistant: {conv['text']}" for conv in conversations])
    parser = PydanticOutputParser(pydantic_object=DailySummary)
    prompt = ChatPromptTemplate.from_template(
        """
        Please evaluate the following conversations and provide:
        1. A concise title of the summary
        2. A concise summary

        Use this format:
        {format_instructions}

        Conversations:
        {conversation_text}
        """
    )
    chain = prompt | llm | parser
    result = chain.invoke({"conversation_text": conversation_text, "format_instructions": parser.get_format_instructions()})
    return result

def daily_summary(conversation_text, llm):
    return summary(conversation_text, llm)
