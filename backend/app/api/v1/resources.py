import uuid

from fastapi import APIRouter, Query

from app.api.deps import COMMON_ERRORS, DB, AdminUser, CurrentUser, PageParam, PageSizeParam
from app.schemas.common import Page
from app.schemas.resources import ResourceCreate, ResourceOut, ResourceUpdate
from app.services import resources as svc

router = APIRouter(prefix="/resources", tags=["resources"], responses=COMMON_ERRORS)


@router.get("", response_model=Page[ResourceOut], summary="List resources (paginated)")
def list_resources(
    db: DB,
    user: CurrentUser,
    page: PageParam = 1,
    page_size: PageSizeParam = 20,
    q: str | None = Query(None, max_length=120),
    location: str | None = Query(None, max_length=120),
    category: str | None = Query(None, max_length=60),
    include_inactive: bool = False,
):
    items, total = svc.list_resources(
        db, user, page, page_size, q, location, category, include_inactive
    )
    return Page[ResourceOut](
        items=[ResourceOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{resource_id}", response_model=ResourceOut, summary="Get a resource")
def get_resource(resource_id: uuid.UUID, db: DB, user: CurrentUser):
    return svc.get_resource(db, user, resource_id)


@router.post("", response_model=ResourceOut, status_code=201, summary="Create a resource (admin)")
def create_resource(data: ResourceCreate, db: DB, admin: AdminUser):
    resource = svc.create_resource(db, admin, data)
    db.commit()
    return resource


@router.patch("/{resource_id}", response_model=ResourceOut, summary="Update a resource (admin)")
def update_resource(resource_id: uuid.UUID, data: ResourceUpdate, db: DB, admin: AdminUser):
    resource = svc.update_resource(db, admin, resource_id, data)
    db.commit()
    return resource


@router.post(
    "/{resource_id}/deactivate",
    response_model=ResourceOut,
    summary="Deactivate a resource; history is kept (admin)",
)
def deactivate_resource(resource_id: uuid.UUID, db: DB, admin: AdminUser):
    resource = svc.deactivate_resource(db, admin, resource_id)
    db.commit()
    return resource
