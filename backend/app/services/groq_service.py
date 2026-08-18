import re
from groq import Groq
from app.config import GROQ_API_KEY

client = Groq(api_key=GROQ_API_KEY)


def ask_groq(messages):
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        raise Exception(f"Groq Error: {str(e)}")
