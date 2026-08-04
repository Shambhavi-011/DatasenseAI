import pandas as pd


def generate_dynamic_charts(df: pd.DataFrame):

    numeric_columns = df.select_dtypes(include="number").columns.tolist()
    categorical_columns = df.select_dtypes(exclude="number").columns.tolist()

    charts = {}

    # Bar Chart
    if categorical_columns and numeric_columns:
        category = categorical_columns[0]
        value = numeric_columns[0]

        bar_data = (
            df.groupby(category)[value]
            .sum()
            .reset_index()
            .head(10)
            .fillna("")
        )

        charts["bar_chart"] = {
            "x": category,
            "y": value,
            "data": bar_data.to_dict(orient="records"),
        }

    # Histogram

    if numeric_columns:

        value = numeric_columns[0]

        charts["histogram"] = {
            "x": value,
            "data": df[value].fillna(0).tolist(),
        }

    return charts