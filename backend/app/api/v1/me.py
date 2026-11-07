from fastapi import APIRouter

from app.api.deps import COMMON_ERRORS, CurrentUser
from app.schemas.bookings import MeOut

router = APIRouter(tags=["me"])


@router.get(
    "/me", response_model=MeOut, responses=COMMON_ERRORS, summary="Current user profile and role"
)
def me(user: CurrentUser) -> MeOut:
    return MeOut(id=user.id, email=user.email, display_name=user.display_name, role=user.role)
