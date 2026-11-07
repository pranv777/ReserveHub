from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


def paginate(db: Session, stmt: Select, page: int, page_size: int):
    """Count + one bounded page. Callers must supply a stable ORDER BY (ending in a unique id)."""
    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = db.execute(stmt.limit(page_size).offset((page - 1) * page_size)).all()
    return rows, total
