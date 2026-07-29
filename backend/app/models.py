from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, nullable=False)
    table_name = Column(String, nullable=False, unique=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    row_count = Column(Integer, nullable=False)
    column_count = Column(Integer, nullable=False)