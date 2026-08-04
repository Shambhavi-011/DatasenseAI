import pandas as pd


def generate_summary(df: pd.DataFrame):
    """
    Generate a generic summary for any CSV dataset.
    """

    rows = len(df)
    columns = len(df.columns)

    numeric_df = df.select_dtypes(include="number")
    categorical_df = df.select_dtypes(exclude="number")

    overview = {
        "rows": rows,
        "columns": columns,
        "numeric_columns": len(numeric_df.columns),
        "categorical_columns": len(categorical_df.columns),
        "missing_values": int(df.isnull().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
    }

    numeric_summary = {}

    if not numeric_df.empty:
        for column in numeric_df.columns:
            numeric_summary[column] = {
                "mean": round(float(numeric_df[column].mean()), 2),
                "median": round(float(numeric_df[column].median()), 2),
                "min": round(float(numeric_df[column].min()), 2),
                "max": round(float(numeric_df[column].max()), 2),
                "std": round(float(numeric_df[column].std()), 2)
                if pd.notna(numeric_df[column].std())
                else 0,
            }

    return {
        "overview": overview,
        "numeric_summary": numeric_summary,
        "column_names": list(df.columns),
    }