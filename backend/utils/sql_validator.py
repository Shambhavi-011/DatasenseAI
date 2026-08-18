import re
import sqlglot
from sqlglot import exp

from app.config import (
    MAX_QUERY_RESULT_ROWS,
    MAX_SQL_LENGTH,
    MAX_SQL_AST_NODES,
    MAX_SQL_AST_DEPTH,
)

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
    if not isinstance(sql, str):
        raise Exception("Invalid SQL.")

    if len(sql) > MAX_SQL_LENGTH:
        raise Exception(
            f"SQL query exceeds the maximum allowed length of {MAX_SQL_LENGTH} characters."
        )

    try:
        parsed = sqlglot.parse_one(sql)
    except Exception as e:
        raise Exception(f"Invalid SQL: {str(e)}")

    node_count = 0
    max_depth = 0

    def walk(node, depth=0):
        nonlocal node_count, max_depth

        node_count += 1
        max_depth = max(max_depth, depth)

        if node_count > MAX_SQL_AST_NODES:
            raise Exception(
                "SQL query is too complex."
            )

        if max_depth > MAX_SQL_AST_DEPTH:
            raise Exception(
                "SQL query nesting is too deep."
            )

        for child in node.iter_expressions():
            walk(child, depth + 1)

    walk(parsed)

    return parsed

def validate_select(parsed_sql):
    """
    Ensure that the parsed SQL is a SELECT statement.
    """

    if not isinstance(parsed_sql, exp.Select):
        raise Exception("Only SELECT statements are allowed.")

    return True    

def validate_query_complexity(parsed_sql):
    """
    Restrict complex read-only query structures.
    """

    # Recursive CTEs are not allowed.
    for cte in parsed_sql.find_all(exp.CTE):
        if cte.args.get("recursive"):
            raise Exception("Recursive CTEs are not allowed.")

    # CTEs are not allowed for now.
    if parsed_sql.find(exp.CTE):
        raise Exception("CTEs are not allowed.")

    # Nested subqueries are not allowed.
    subqueries = list(parsed_sql.find_all(exp.Subquery))

    if subqueries:
        raise Exception("Subqueries are not allowed.")

    return True

def validate_result_limit(parsed_sql):
    """Validate the root SELECT LIMIT using SQLGlot's parsed AST."""
    limit = parsed_sql.args.get("limit")

    if limit is None:
        return False

    limit_expression = limit.expression

    if not isinstance(limit_expression, exp.Literal) or not limit_expression.is_int:
        raise Exception("Query LIMIT must be a non-negative integer.")

    limit_value = int(limit_expression.this)

    if limit_value < 0 or limit_value > MAX_QUERY_RESULT_ROWS:
        raise Exception(
            f"Query LIMIT must be between 0 and {MAX_QUERY_RESULT_ROWS}."
        )

    return True


def validate_sql(sql: str, table_name: str, allowed_columns: list):
    parsed = parse_sql(sql)

    validate_select(parsed)

    validate_query_complexity(parsed)

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

    if not validate_result_limit(parsed):
        sql = f"{sql.rstrip().rstrip(';').rstrip()} LIMIT {MAX_QUERY_RESULT_ROWS}"

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
