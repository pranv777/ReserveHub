import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models.profile import Profile
from app.models.resource import Resource
from app.schemas.resources import ResourceCreate, ResourceUpdate
from app.services import policy
from app.services.audit import record_audit
from app.services.pagination import paginate


def create_resource(db: Session, admin: Profile, data: ResourceCreate) -> Resource:
    resource = Resource(**data.model_dump())
    db.add(resource)
    db.flush()
    record_audit(db, "resource.created", admin.id, "resource", resource.id, {"name": resource.name})
    return resource


def get_resource(db: Session, user: Profile, resource_id: uuid.UUID) -> Resource:
    resource = db.get(Resource, resource_id)
    if resource is None or (not resource.is_active and not policy.is_admin(user.role)):
        raise NotFoundError("Resource not found.", code="resource_not_found")
    return resource


def list_resources(
    db: Session,
    user: Profile,
    page: int,
    page_size: int,
    q: str | None,
    location: str | None,
    category: str | None,
    include_inactive: bool,
):
    stmt = select(Resource)
    if not (include_inactive and policy.is_admin(user.role)):
        stmt = stmt.where(Resource.is_active.is_(True))
    if q:
        stmt = stmt.where(Resource.name.ilike(f"%{q}%"))
    if location:
        stmt = stmt.where(Resource.location == location)
    if category:
        stmt = stmt.where(Resource.category == category)
    stmt = stmt.order_by(Resource.name, Resource.id)
    rows, total = paginate(db, stmt, page, page_size)
    return [r[0] for r in rows], total


def update_resource(
    db: Session, admin: Profile, resource_id: uuid.UUID, data: ResourceUpdate
) -> Resource:
    resource = db.execute(
        select(Resource).where(Resource.id == resource_id).with_for_update()
    ).scalar_one_or_none()
    if resource is None:
        raise NotFoundError("Resource not found.", code="resource_not_found")
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        setattr(resource, field, value)
    db.flush()
    record_audit(
        db, "resource.updated", admin.id, "resource", resource.id, {"fields": sorted(changes)}
    )
    return resource


def deactivate_resource(db: Session, admin: Profile, resource_id: uuid.UUID) -> Resource:
    """Soft delete: history (slots, bookings, audit) is preserved."""
    resource = db.execute(
        select(Resource).where(Resource.id == resource_id).with_for_update()
    ).scalar_one_or_none()
    if resource is None:
        raise NotFoundError("Resource not found.", code="resource_not_found")
    if resource.is_active:
        resource.is_active = False
        db.flush()
        record_audit(
            db, "resource.deactivated", admin.id, "resource", resource.id, {"name": resource.name}
        )
    return resource
