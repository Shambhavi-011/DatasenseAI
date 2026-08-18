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

MAX_QUESTION_LENGTH = int(
    os.getenv("MAX_QUESTION_LENGTH", "2000")
)

MAX_QUERY_RESULT_ROWS = int(
    os.getenv("MAX_QUERY_RESULT_ROWS", "100")
)

SQL_QUERY_TIMEOUT_SECONDS = int(
    os.getenv("SQL_QUERY_TIMEOUT_SECONDS", "5")
)

MAX_SQL_LENGTH = int(
    os.getenv("MAX_SQL_LENGTH", "10000")
)


MAX_SQL_AST_NODES = int(
    os.getenv("MAX_SQL_AST_NODES", "500")
)


MAX_SQL_AST_DEPTH = int(
    os.getenv("MAX_SQL_AST_DEPTH", "20")
)

MAX_RESULT_COLUMNS = int(
    os.getenv("MAX_RESULT_COLUMNS", "100")
)

MAX_RESULT_CELL_LENGTH = int(
    os.getenv("MAX_RESULT_CELL_LENGTH", "10000")
)

