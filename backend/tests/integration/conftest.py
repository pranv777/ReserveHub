import pytest


@pytest.fixture(autouse=True)
def _db(clean_db):
    yield
