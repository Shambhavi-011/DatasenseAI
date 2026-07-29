import re
from typing import Dict, List, Optional

import pandas as pd


def normalize_column_name(column_name: str) -> str:
    column_name = str(column_name).strip().lower()
    column_name = re.sub(r"\s+", "_", column_name)
    column_name = re.sub(r"[^a-z0-9_]+", "_", column_name)
    column_name = re.sub(r"_+", "_", column_name).strip("_")
    return column_name


def build_normalized_column_map(columns) -> Dict[str, str]:
    return {col: normalize_column_name(col) for col in columns}


def rename_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    return df.rename(columns=build_normalized_column_map(df.columns))


def validate_required_columns(df: pd.DataFrame, required_columns: Dict[str, str]) -> List[dict]:
    missing_columns = []
    for required_col, reason in required_columns.items():
        if required_col not in df.columns:
            missing_columns.append(
                {
                    "column": required_col,
                    "business_use": reason,
                }
            )
    return missing_columns


COLUMN_ALIASES = {
    "revenue": ["revenue", "sales", "amount", "total_sales", "sale_amount"],
    "profit": ["profit", "net_profit", "earnings"],
    "quantity": ["quantity", "units_sold", "qty", "count"],
    "order_id": ["order_id", "orderid", "invoice_id", "transaction_id"],
    "product": ["product", "item", "name", "category"],
    "region": ["region", "state", "city", "location"],
    "date": ["date", "order_date", "transaction_date", "created_at"],
}


def find_column_by_aliases(df: pd.DataFrame, logical_name: str) -> Optional[str]:
    aliases = COLUMN_ALIASES.get(logical_name, [])
    normalized_cols = set(df.columns)
    for alias in aliases:
        if alias in normalized_cols:
            return alias
    return None