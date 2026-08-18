from pydantic import BaseModel, Field, field_validator

from app.config import MAX_QUESTION_LENGTH


class AskRequest(BaseModel):
    question: str = Field(..., max_length=MAX_QUESTION_LENGTH)

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Question must not be empty.")

        return value
