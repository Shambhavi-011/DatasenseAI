def parse_ai_response(text: str):
    result = {
        "sql_query": "",
        "chart_type": "",
        "title": "",
        "plain_language_answer": ""
    }

    current = None

    for line in text.splitlines():
        line = line.strip()

        if line.startswith("SQL_QUERY:"):
            current = "sql_query"
            result[current] = line.replace("SQL_QUERY:", "").strip()

        elif line.startswith("CHART_TYPE:"):
            current = "chart_type"
            result[current] = line.replace("CHART_TYPE:", "").strip()

        elif line.startswith("TITLE:"):
            current = "title"
            result[current] = line.replace("TITLE:", "").strip()

        elif line.startswith("ANSWER:"):
            current = "plain_language_answer"
            result[current] = line.replace("ANSWER:", "").strip()

        elif current:
            result[current] += "\n" + line

    return result