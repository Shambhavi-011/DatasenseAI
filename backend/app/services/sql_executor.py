import sqlite3
import time

import pandas as pd
from sqlalchemy import text

from app.config import (
    SQL_QUERY_TIMEOUT_SECONDS,
    MAX_RESULT_COLUMNS,
    MAX_RESULT_CELL_LENGTH,
)
from app.database import engine


def execute_sql(sql: str):
    """
    Execute validated SQL with a SQLite execution time limit.
    """

    with engine.connect() as conn:
        raw_connection = conn.connection.driver_connection

        start_time = time.monotonic()
        timeout_triggered = False

        def progress_handler():
            nonlocal timeout_triggered

            if time.monotonic() - start_time >= SQL_QUERY_TIMEOUT_SECONDS:
                timeout_triggered = True
                return 1

            return 0

        raw_connection.set_progress_handler(
            progress_handler,
            10000,
        )

        try:
            df = pd.read_sql(text(sql), conn)

        except sqlite3.OperationalError as e:
            if timeout_triggered:
                raise Exception(
                    "SQL query execution timed out."
                ) from e

            raise

        finally:
            raw_connection.set_progress_handler(None, 0)

    return df


def dataframe_to_json(df):
    """
    Convert DataFrame into frontend-friendly JSON with result-size protection.
    """

    if len(df.columns) > MAX_RESULT_COLUMNS:
        raise Exception("Query result contains too many columns.")

    for column in df.columns:
        for value in df[column]:
            if isinstance(value, str) and len(value) > MAX_RESULT_CELL_LENGTH:
                raise Exception("Query result contains an oversized cell.")

    return {
        "columns": list(df.columns),
        "rows": df.to_dict(orient="records"),
        "row_count": len(df),
    }