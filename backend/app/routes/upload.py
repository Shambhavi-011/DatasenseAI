from fastapi import APIRouter, UploadFile, File, HTTPException, status
from sqlalchemy import Table, MetaData, select
from sqlalchemy.exc import SQLAlchemyError, NoSuchTableError
from app.database import engine
from app.models import Dataset
from app.services.dataset_fields import (
    normalize_column_name,
    rename_dataframe_columns,
    validate_required_columns,
)
import pandas as pd
import re


router = APIRouter(prefix="/api/datasets", tags=["Datasets"])


def get_dataset_record(dataset_id: int):
    with engine.connect() as connection:
        dataset_result = connection.execute(
            select(
                Dataset.id,
                Dataset.file_name,
                Dataset.table_name,
                Dataset.row_count,
                Dataset.column_count,
            ).where(Dataset.id == dataset_id)
        ).first()

        if not dataset_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found.",
            )

        return dataset_result


def load_dataset_as_dataframe(table_name: str) -> pd.DataFrame:
    query = f'SELECT * FROM "{table_name}"'
    return pd.read_sql_query(query, engine)


def validate_columns(df: pd.DataFrame, required_columns: dict):
    df = rename_dataframe_columns(df)
    missing_columns = validate_required_columns(df, required_columns)

    if missing_columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "This dataset is missing required columns.",
                "missing_columns": missing_columns,
                "available_columns": list(df.columns),
            },
        )

    return df


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are allowed.",
        )

    try:
        df = pd.read_csv(file.file)

        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded CSV file is empty.",
            )

        df = rename_dataframe_columns(df)

        safe_table_name = f"dataset_{file.filename.rsplit('.', 1)[0].lower().replace(' ', '_')}"
        safe_table_name = re.sub(r"[^a-z0-9_]+", "_", safe_table_name)

        with engine.begin() as connection:
            existing_tables = connection.dialect.get_table_names(connection)

            final_table_name = safe_table_name
            counter = 1
            while final_table_name in existing_tables:
                final_table_name = f"{safe_table_name}_{counter}"
                counter += 1

            df.to_sql(final_table_name, connection, index=False, if_exists="fail")

            insert_result = connection.execute(
                Dataset.__table__.insert().values(
                    file_name=file.filename,
                    table_name=final_table_name,
                    row_count=len(df),
                    column_count=len(df.columns),
                )
            )

            dataset_id = insert_result.inserted_primary_key[0]

        return {
            "message": "Dataset uploaded successfully.",
            "dataset": {
                "dataset_id": dataset_id,
                "file_name": file.filename,
                "table_name": final_table_name,
                "row_count": len(df),
                "column_count": len(df.columns),
                "column_names": list(df.columns),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not upload dataset: {str(e)}",
        )


@router.get("")
def list_datasets():
    try:
        with engine.connect() as connection:
            results = connection.execute(
                select(
                    Dataset.id,
                    Dataset.file_name,
                    Dataset.table_name,
                    Dataset.row_count,
                    Dataset.column_count,
                    Dataset.uploaded_at,
                ).order_by(Dataset.uploaded_at.desc())
            ).fetchall()

            datasets = []
            for row in results:
                datasets.append(
                    {
                        "dataset_id": row.id,
                        "file_name": row.file_name,
                        "table_name": row.table_name,
                        "row_count": row.row_count,
                        "column_count": row.column_count,
                        "uploaded_at": row.uploaded_at,
                    }
                )

            return {
                "total_datasets": len(datasets),
                "datasets": datasets,
            }

    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not fetch datasets: {str(e)}",
        )


@router.get("/{dataset_id}/preview")
def preview_dataset(dataset_id: int):
    if dataset_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found.",
        )

    try:
        dataset = get_dataset_record(dataset_id)

        metadata = MetaData()
        try:
            dataset_table = Table(
                dataset.table_name,
                metadata,
                autoload_with=engine,
            )
        except NoSuchTableError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset table not found.",
            )

        with engine.connect() as connection:
            preview_result = connection.execute(select(dataset_table).limit(10))
            preview_rows = [dict(row._mapping) for row in preview_result]

        return {
            "dataset": {
                "dataset_id": dataset.id,
                "file_name": dataset.file_name,
                "table_name": dataset.table_name,
                "row_count": dataset.row_count,
                "column_count": dataset.column_count,
            },
            "column_names": list(dataset_table.columns.keys()),
            "preview_rows": preview_rows,
            "preview_row_count": len(preview_rows),
        }

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not load dataset preview: {str(e)}",
        )


@router.get("/{dataset_id}/summary")
def get_dataset_summary(dataset_id: int):
    if dataset_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found.",
        )

    try:
        dataset = get_dataset_record(dataset_id)
        df = load_dataset_as_dataframe(dataset.table_name)
        df = rename_dataframe_columns(df)

        required_columns = {
            "revenue": "Used to calculate total sales revenue.",
            "quantity": "Used to calculate total units sold.",
            "product": "Used to find top-selling product.",
            "region": "Used to find top revenue region.",
        }

        missing_columns = validate_required_columns(df, required_columns)
        if missing_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "This dataset is missing required columns for summary.",
                    "missing_columns": missing_columns,
                    "available_columns": list(df.columns),
                },
            )

        df["revenue"] = pd.to_numeric(df["revenue"], errors="coerce").fillna(0)
        df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(0)
        df["product"] = df["product"].fillna("Unknown").astype(str).str.strip()
        df["region"] = df["region"].fillna("Unknown").astype(str).str.strip()

        total_revenue = float(df["revenue"].sum())
        total_quantity_sold = int(df["quantity"].sum())
        total_orders = int(df["order_id"].nunique()) if "order_id" in df.columns else int(len(df))

        product_revenue = df.groupby("product", dropna=False)["revenue"].sum()
        top_product = product_revenue.idxmax() if not product_revenue.empty else None
        top_product_revenue = float(product_revenue.max()) if not product_revenue.empty else 0.0

        region_revenue = df.groupby("region", dropna=False)["revenue"].sum()
        top_region = region_revenue.idxmax() if not region_revenue.empty else None
        top_region_revenue = float(region_revenue.max()) if not region_revenue.empty else 0.0

        return {
            "dataset": {
                "dataset_id": dataset.id,
                "file_name": dataset.file_name,
                "table_name": dataset.table_name,
                "row_count": dataset.row_count,
                "column_count": dataset.column_count,
            },
            "kpis": {
                "total_revenue": {
                    "value": total_revenue,
                    "meaning": "Total sales amount generated from all rows in the dataset.",
                },
                "total_quantity_sold": {
                    "value": total_quantity_sold,
                    "meaning": "Total number of units sold across all rows.",
                },
                "total_orders": {
                    "value": total_orders,
                    "meaning": "Total unique orders if order_id exists, otherwise total rows.",
                },
                "top_selling_product_by_revenue": {
                    "value": top_product,
                    "revenue": top_product_revenue,
                    "meaning": "Product that generated the highest revenue.",
                },
                "top_region_by_revenue": {
                    "value": top_region,
                    "revenue": top_region_revenue,
                    "meaning": "Region that contributed the highest total revenue.",
                },
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not generate dataset summary: {str(e)}",
        )