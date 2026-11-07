import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ResourceCreate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "name": "Meeting Room A",
                "location": "Floor 2",
                "category": "room",
                "capacity": 8,
            }
        },
    )
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    location: str = Field(default="", max_length=120)
    category: str = Field(default="", max_length=60)
    capacity: int = Field(default=1, ge=1, le=10000)


class ResourceUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=120)
    category: str | None = Field(default=None, max_length=60)
    capacity: int | None = Field(default=None, ge=1, le=10000)


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str
    location: str
    category: str
    capacity: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
