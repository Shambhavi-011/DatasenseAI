import pandas as pd
from sqlalchemy import text

from app.database import engine


def execute_sql(sql: str):
    """
    Execute validated SQL and return a DataFrame.
    """

    with engine.connect() as conn:
        df = pd.read_sql(text(sql), conn)

    return df


def dataframe_to_json(df):
    """
    Convert DataFrame into frontend-friendly JSON.
    """

    return {
        "columns": list(df.columns),
        "rows": df.to_dict(orient="records"),
        "row_count": len(df)
    }