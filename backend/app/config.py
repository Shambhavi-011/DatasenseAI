import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

MAX_UPLOAD_SIZE_MB = int(
    os.getenv("MAX_UPLOAD_SIZE_MB", "0")
)

CSV_CHUNK_SIZE = int(
    os.getenv("CSV_CHUNK_SIZE", "50000")
)

SQL_INSERT_BATCH_SIZE = int(
    os.getenv("SQL_INSERT_BATCH_SIZE", "5000")
)

MAX_COLUMNS = int(
    os.getenv("MAX_COLUMNS", "500")
)

MAX_ROWS = int(
    os.getenv("MAX_ROWS", "0")
)
