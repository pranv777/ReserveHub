from fastapi import APIRouter

from app.api.v1 import admin, bookings, health, me, notifications, resources, slots, waitlist

api_router = APIRouter()
for module in (health, me, resources, slots, bookings, waitlist, notifications, admin):
    api_router.include_router(module.router)
