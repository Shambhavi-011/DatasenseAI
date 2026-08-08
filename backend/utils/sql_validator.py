import re
import sqlglot
from sqlglot import exp

BLOCKED_KEYWORDS = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "CREATE",
    "ATTACH",
    "PRAGMA",
    "TRUNCATE",
    "REPLACE"
]
def parse_sql(sql: str):
    try:
        return sqlglot.parse_one(sql)
    except Exception as e:
        raise Exception(f"Invalid SQL: {str(e)}")

def validate_select(parsed_sql):
    """
    Ensure that the parsed SQL is a SELECT statement.
    """

    if not isinstance(parsed_sql, exp.Select):
        raise Exception("Only SELECT statements are allowed.")

    return True    


def validate_sql(sql: str, table_name: str, allowed_columns: list):
    parsed = parse_sql(sql)

    validate_select(parsed)

    validate_table(parsed, table_name)

    validate_columns(
    parsed,
    allowed_columns
)

    sql_upper = sql.upper()

    # Only SELECT
    if not sql_upper.strip().startswith("SELECT"):
        raise Exception("Only SELECT queries are allowed.")

    # Multiple statements
    if ";" in sql.strip()[:-1]:
        raise Exception("Multiple SQL statements are not allowed.")

    # Comments
    if "--" in sql or "/*" in sql or "*/" in sql:
        raise Exception("SQL comments are not allowed.")

    # Dangerous keywords
    for keyword in BLOCKED_KEYWORDS:
        if keyword in sql_upper:
            raise Exception(f"{keyword} is not allowed.")

    # Correct table
    if table_name not in sql:
        raise Exception("Invalid table name.")

    # Row limit
    if "LIMIT" not in sql_upper:
        sql += " LIMIT 100"

    return sql

def validate_table(parsed_sql, allowed_table: str):
    """
    Ensure that the SQL uses only the uploaded dataset table.
    """


    tables = list(parsed_sql.find_all(exp.Table))

    if len(tables) != 1:
        raise Exception("Exactly one table must be used.")

    table_name = tables[0].name

    if table_name != allowed_table:
        raise Exception(
            f"Invalid table '{table_name}'. Allowed table is '{allowed_table}'."
        )

    return True
ALLOWED_FUNCTIONS = {
    "SUM",
    "COUNT",
    "AVG",
    "MIN",
    "MAX",
    "ROUND",
    "LOWER",
    "UPPER",
    "LENGTH"
}
from sqlglot import exp


def validate_columns(parsed_sql, allowed_columns):

    allowed = {c.lower() for c in allowed_columns}

    for column in parsed_sql.find_all(exp.Column):

        name = column.name

        if name == "*":
            continue

        if name.lower() not in allowed:
            raise Exception(
                f"Invalid column '{name}'."
            )

    for func in parsed_sql.find_all(exp.Anonymous):

        if func.name.upper() not in ALLOWED_FUNCTIONS:

            raise Exception(
                f"Function '{func.name}' is not allowed."
            )

    return True