from fastapi import APIRouter, UploadFile, File, HTTPException, status
from sqlalchemy import Table, MetaData, select
from sqlalchemy.exc import SQLAlchemyError, NoSuchTableError
import logging
from app.database import engine
from app.services.chart_service import generate_dynamic_charts
from app.services.summary_service import generate_summary
from app.models import Dataset
from app.services.dataset_fields import (
    normalize_column_name,
    rename_dataframe_columns,
    validate_required_columns,
)
import pandas as pd
import re
from app.schemas.ai import AskRequest
from app.services.sql_executor import execute_sql

from app.prompts.sql_prompt import build_sql_prompt
from app.services.groq_service import ask_groq
from app.services.ai_parser import parse_ai_response


from utils.sql_validator import parse_sql, validate_sql
router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

from app.services.sql_executor import (
    execute_sql,
    dataframe_to_json,
)

from app.config import (
    CSV_CHUNK_SIZE,
    SQL_INSERT_BATCH_SIZE,
    MAX_COLUMNS,
    MAX_ROWS,
)


logger = logging.getLogger(__name__)


FILE_SNIFF_BYTES = 8192


def validate_upload_file(file: UploadFile) -> None:
    """Reject uploads that are clearly not usable CSV text before parsing."""
    filename = (file.filename or "").strip()

    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A CSV file with a filename is required.",
        )

    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are allowed.",
        )

    file.file.seek(0)
    sample = file.file.read(FILE_SNIFF_BYTES)
    file.file.seek(0)

    if not sample:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded CSV file is empty.",
        )

    if b"\x00" in sample:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a text CSV file.",
        )


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


def get_dataset_column_names(table_name: str) -> list[str]:
    metadata = MetaData()
    dataset_table = Table(
        table_name,
        metadata,
        autoload_with=engine,
    )

    return list(dataset_table.columns.keys())


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

def get_csv_schema(file):
    """
    Read only the CSV header to determine the dataset schema.
    """
    header_df = pd.read_csv(file.file, nrows=0)

    if header_df.empty and len(header_df.columns) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded CSV file has no columns.",
        )

    header_df = rename_dataframe_columns(header_df)

    if len(header_df.columns) > MAX_COLUMNS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV contains too many columns. Maximum allowed: {MAX_COLUMNS}.",
        )

    return list(header_df.columns)


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):

    try:
        validate_upload_file(file)

        # Start from beginning of uploaded file
        file.file.seek(0)

        # Read only header to detect schema
        header_df = pd.read_csv(file.file, nrows=0)

        if len(header_df.columns) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded CSV has no columns.",
            )

        header_df = rename_dataframe_columns(header_df)

        # Column limit
        if MAX_COLUMNS > 0 and len(header_df.columns) > MAX_COLUMNS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CSV contains too many columns. Maximum allowed: {MAX_COLUMNS}.",
            )

        column_names = list(header_df.columns)

        # Reset file pointer before reading actual data
        file.file.seek(0)

        # Generate safe table name
        safe_table_name = (
            f"dataset_"
            f"{file.filename.rsplit('.', 1)[0].lower().replace(' ', '_')}"
        )

        safe_table_name = re.sub(
            r"[^a-z0-9_]+",
            "_",
            safe_table_name
        )

        total_rows = 0
        final_table_name = None

        # Read CSV in chunks
        chunks = pd.read_csv(
            file.file,
            chunksize=CSV_CHUNK_SIZE
        )

        with engine.begin() as connection:

            existing_tables = connection.dialect.get_table_names(
                connection
            )

            final_table_name = safe_table_name
            counter = 1

            while final_table_name in existing_tables:
                final_table_name = f"{safe_table_name}_{counter}"
                counter += 1

            first_chunk = True

            for chunk in chunks:

                # Rename columns consistently
                chunk = rename_dataframe_columns(chunk)

                # Row limit (0 = unlimited)
                if MAX_ROWS > 0:
                    remaining_rows = MAX_ROWS - total_rows

                    if remaining_rows <= 0:
                        break

                    chunk = chunk.iloc[:remaining_rows]

                if chunk.empty:
                    continue

                # Insert chunk into SQLite
                chunk.to_sql(
                    final_table_name,
                    connection,
                    index=False,
                    if_exists="replace" if first_chunk else "append",
                    chunksize=SQL_INSERT_BATCH_SIZE,
                )

                total_rows += len(chunk)

                first_chunk = False

        if total_rows == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded CSV file is empty.",
            )

        # Save dataset metadata
        with engine.begin() as connection:

            insert_result = connection.execute(
                Dataset.__table__.insert().values(
                    file_name=file.filename,
                    table_name=final_table_name,
                    row_count=total_rows,
                    column_count=len(column_names),
                )
            )

            dataset_id = insert_result.inserted_primary_key[0]

        return {
            "message": "Dataset uploaded successfully.",
            "dataset": {
                "dataset_id": dataset_id,
                "file_name": file.filename,
                "table_name": final_table_name,
                "row_count": total_rows,
                "column_count": len(column_names),
                "column_names": column_names,
            },
        }

    except HTTPException:
        raise

    except (pd.errors.EmptyDataError, pd.errors.ParserError, UnicodeDecodeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid CSV file.",
        )

    except Exception:
        logger.exception("Failed to process uploaded CSV")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not process the uploaded CSV file.",
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

    except SQLAlchemyError:
        logger.exception("Failed to list datasets")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to retrieve datasets.",
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
    except SQLAlchemyError:
        logger.exception("Failed to load dataset preview for dataset_id=%s", dataset_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load the dataset preview.",
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
    except Exception:
        logger.exception("Failed to generate dataset summary for dataset_id=%s", dataset_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate the dataset summary.",
        )
@router.get("/{dataset_id}/charts/revenue-by-region")
def revenue_by_region_chart(dataset_id: int):
    try:
        dataset = get_dataset_record(dataset_id)
        df = load_dataset_as_dataframe(dataset.table_name)
        df = rename_dataframe_columns(df)

        required_columns = {
            "region": "Used to group revenue by region.",
            "revenue": "Used to calculate total revenue.",
        }

        missing_columns = validate_required_columns(df, required_columns)
        if missing_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "This dataset is missing required columns for region chart.",
                    "missing_columns": missing_columns,
                    "available_columns": list(df.columns),
                },
            )

        df["region"] = df["region"].fillna("Unknown").astype(str).str.strip()
        df["revenue"] = pd.to_numeric(df["revenue"], errors="coerce").fillna(0)

        chart_df = (
            df.groupby("region", dropna=False)["revenue"]
            .sum()
            .reset_index()
            .sort_values("revenue", ascending=False)
        )

        if chart_df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No revenue data found for region chart.",
            )

        return {
            "title": "Revenue by Region",
            "chart_type": "bar",
            "x_axis": "region",
            "y_axis": "revenue",
            "data": chart_df.to_dict(orient="records"),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "Failed to generate revenue-by-region chart for dataset_id=%s",
            dataset_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate the revenue-by-region chart.",
        )


@router.get("/{dataset_id}/charts/revenue-by-product")
def revenue_by_product_chart(dataset_id: int):
    try:
        dataset = get_dataset_record(dataset_id)
        df = load_dataset_as_dataframe(dataset.table_name)
        df = rename_dataframe_columns(df)

        required_columns = {
            "product": "Used to group revenue by product.",
            "revenue": "Used to calculate product revenue totals.",
        }

        missing_columns = validate_required_columns(df, required_columns)
        if missing_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "This dataset is missing required columns for product chart.",
                    "missing_columns": missing_columns,
                    "available_columns": list(df.columns),
                },
            )

        df["product"] = df["product"].fillna("Unknown").astype(str).str.strip()
        df["revenue"] = pd.to_numeric(df["revenue"], errors="coerce").fillna(0)

        chart_df = (
            df.groupby("product", dropna=False)["revenue"]
            .sum()
            .reset_index()
            .sort_values("revenue", ascending=False)
        )

        if chart_df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No revenue data found for product chart.",
            )

        return {
            "title": "Revenue by Product",
            "chart_type": "bar",
            "x_axis": "product",
            "y_axis": "revenue",
            "data": chart_df.to_dict(orient="records"),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "Failed to generate revenue-by-product chart for dataset_id=%s",
            dataset_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate the revenue-by-product chart.",
        )


@router.get("/{dataset_id}/charts/monthly-revenue")
def monthly_revenue_chart(dataset_id: int):
    try:
        dataset = get_dataset_record(dataset_id)
        df = load_dataset_as_dataframe(dataset.table_name)
        df = rename_dataframe_columns(df)

        date_aliases = ["date", "order_date", "transaction_date", "created_at"]
        date_column = None
        for candidate in date_aliases:
            if candidate in df.columns:
                date_column = candidate
                break

        if not date_column:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "This dataset is missing a valid date column for monthly chart.",
                    "required_date_columns": date_aliases,
                    "available_columns": list(df.columns),
                },
            )

        if "revenue" not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Revenue column is required for monthly revenue chart.",
                    "available_columns": list(df.columns),
                },
            )

        df["revenue"] = pd.to_numeric(df["revenue"], errors="coerce").fillna(0)
        df[date_column] = pd.to_datetime(df[date_column], errors="coerce")

        valid_df = df.dropna(subset=[date_column]).copy()
        if valid_df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid dates found in the dataset.",
            )

        valid_df["month"] = valid_df[date_column].dt.to_period("M").astype(str)

        chart_df = (
            valid_df.groupby("month", dropna=False)["revenue"]
            .sum()
            .reset_index()
            .sort_values("month")
        )

        return {
            "title": "Monthly Revenue Trend",
            "chart_type": "line",
            "x_axis": "month",
            "y_axis": "revenue",
            "data": chart_df.to_dict(orient="records"),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "Failed to generate monthly revenue chart for dataset_id=%s",
            dataset_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate the monthly revenue chart.",
        )
    
@router.get("/{dataset_id}/dynamic-summary")
def get_dynamic_summary(dataset_id: int):
    try:
        dataset = get_dataset_record(dataset_id)
        df = load_dataset_as_dataframe(dataset.table_name)
        df = rename_dataframe_columns(df)

        summary = generate_summary(df)

        return {
            "dataset": {
                "dataset_id": dataset.id,
                "file_name": dataset.file_name,
                "table_name": dataset.table_name,
                "row_count": dataset.row_count,
                "column_count": dataset.column_count,
            },
            **summary,
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to generate dynamic summary for dataset_id=%s", dataset_id)
        raise HTTPException(
            status_code=500,
            detail="Unable to generate the dataset summary.",
        )

@router.get("/{dataset_id}/dynamic-charts")
def get_dynamic_charts(dataset_id: int):
    try:
        dataset = get_dataset_record(dataset_id)

        df = load_dataset_as_dataframe(dataset.table_name)

        df = rename_dataframe_columns(df)

        return generate_dynamic_charts(df)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to generate dynamic charts for dataset_id=%s", dataset_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate charts for this dataset.",
        )

@router.post("/{dataset_id}/ask")
def ask_dataset(dataset_id: int, request: AskRequest):

    try:
        dataset = get_dataset_record(dataset_id)

        columns = get_dataset_column_names(dataset.table_name)

        prompt = build_sql_prompt(
            table_name=dataset.table_name,
            columns=columns,
            question=request.question
        )

        ai_response = ask_groq(prompt)

        parsed = parse_ai_response(ai_response)

        logger.debug(
            "Parsed AI response for dataset_id=%s; sql_query_present=%s",
            dataset_id,
            bool(parsed.get("sql_query")),
        )

        try:
            validated_sql = validate_sql(
                sql=parsed["sql_query"],
                table_name=dataset.table_name,
                allowed_columns=columns
            )
        except Exception as exc:
            logger.warning(
                "Generated SQL validation failed for dataset_id=%s; error_type=%s",
                dataset_id,
                type(exc).__name__,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The generated query is not permitted for this dataset.",
            )

        df_result = execute_sql(validated_sql)

        result = dataframe_to_json(df_result)

        return {
            "dataset": dataset.file_name,
            "table": dataset.table_name,
            "columns": columns,
            "ai": parsed,
            "result": result
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
           "Failed to process ask request for dataset_id=%s",
         dataset_id,
   )
        logger.error(
        "Failed to process ask request for dataset_id=%s; error_type=%s",
          dataset_id,
        type(e).__name__,
   )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process your question. Please try again.",
        )

@router.get("/test-validator")
def test_validator(sql: str = ""):
    try:
        validated_sql = validate_sql(
            sql=sql,
            table_name="dataset_demo",
            allowed_columns=["region", "revenue"]
        )

        return {
            "status": "VALID SQL",
            "validated_sql": validated_sql
        }

    except Exception as e:
        logger.exception("SQL validator test endpoint failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SQL validation failed."
        )