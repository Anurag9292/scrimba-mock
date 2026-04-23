import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


SCRIMS_URL = "/api/scrims/"


def _make_scrim_payload(**overrides) -> dict:
    """Return a valid ScrimCreate payload with optional overrides."""
    defaults = {
        "title": "My First Scrim",
        "description": "A test scrim",
        "duration_ms": 5000,
        "initial_code": "<h1>Hello</h1>",
        "language": "html",
        "code_events": [{"type": "insert", "text": "h"}],
        "files": {"index.html": "<h1>Hello</h1>"},
    }
    defaults.update(overrides)
    return defaults


# ── POST /api/scrims/ ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_scrim_returns_201(client: AsyncClient, creator_user):
    _, token = creator_user
    payload = _make_scrim_payload()
    response = await client.post(SCRIMS_URL, json=payload, headers=auth_headers(token))

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["description"] == payload["description"]
    assert data["duration_ms"] == payload["duration_ms"]
    assert data["initial_code"] == payload["initial_code"]
    assert data["language"] == payload["language"]
    assert data["code_events"] == payload["code_events"]
    assert data["files"] == payload["files"]
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data
    # video_filename should be None for a freshly created scrim
    assert data["video_filename"] is None


@pytest.mark.asyncio
async def test_create_scrim_with_defaults(client: AsyncClient, creator_user):
    """Only title is truly required; other fields should use defaults."""
    _, token = creator_user
    response = await client.post(SCRIMS_URL, json={"title": "Minimal"}, headers=auth_headers(token))

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Minimal"
    assert data["description"] is None
    assert data["duration_ms"] == 0
    assert data["initial_code"] == ""
    assert data["language"] == "html"
    assert data["code_events"] == []
    assert data["files"] is None


# ── GET /api/scrims/ ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_scrims_empty(client: AsyncClient, creator_user):
    _, token = creator_user
    response = await client.get(SCRIMS_URL, headers=auth_headers(token))
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_scrims_with_data(client: AsyncClient, creator_user):
    _, token = creator_user
    # Create two scrims
    await client.post(SCRIMS_URL, json=_make_scrim_payload(title="First"), headers=auth_headers(token))
    await client.post(SCRIMS_URL, json=_make_scrim_payload(title="Second"), headers=auth_headers(token))

    response = await client.get(SCRIMS_URL, headers=auth_headers(token))
    assert response.status_code == 200
    scrims = response.json()
    assert len(scrims) == 2
    # Ordered by created_at desc, so "Second" should come first
    titles = [s["title"] for s in scrims]
    assert "First" in titles
    assert "Second" in titles


# ── GET /api/scrims/{id} ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_scrim_by_id(client: AsyncClient, creator_user):
    _, token = creator_user
    create_resp = await client.post(SCRIMS_URL, json=_make_scrim_payload(), headers=auth_headers(token))
    scrim_id = create_resp.json()["id"]

    response = await client.get(f"{SCRIMS_URL}{scrim_id}", headers=auth_headers(token))
    assert response.status_code == 200
    assert response.json()["id"] == scrim_id
    assert response.json()["title"] == "My First Scrim"


@pytest.mark.asyncio
async def test_get_scrim_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    fake_id = str(uuid.uuid4())
    response = await client.get(f"{SCRIMS_URL}{fake_id}", headers=auth_headers(token))
    assert response.status_code == 404
    assert response.json()["detail"] == "Scrim not found"


# ── PUT /api/scrims/{id} ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_scrim_title_and_description(client: AsyncClient, creator_user):
    _, token = creator_user
    create_resp = await client.post(SCRIMS_URL, json=_make_scrim_payload(), headers=auth_headers(token))
    scrim_id = create_resp.json()["id"]

    update_payload = {"title": "Updated Title", "description": "New description"}
    response = await client.put(f"{SCRIMS_URL}{scrim_id}", json=update_payload, headers=auth_headers(token))

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["description"] == "New description"
    # Other fields should remain unchanged
    assert data["language"] == "html"
    assert data["initial_code"] == "<h1>Hello</h1>"


@pytest.mark.asyncio
async def test_update_scrim_partial(client: AsyncClient, creator_user):
    """Updating only one field should leave others intact."""
    _, token = creator_user
    create_resp = await client.post(SCRIMS_URL, json=_make_scrim_payload(), headers=auth_headers(token))
    scrim_id = create_resp.json()["id"]
    original = create_resp.json()

    response = await client.put(f"{SCRIMS_URL}{scrim_id}", json={"language": "javascript"}, headers=auth_headers(token))

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "javascript"
    assert data["title"] == original["title"]
    assert data["description"] == original["description"]


@pytest.mark.asyncio
async def test_update_scrim_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    fake_id = str(uuid.uuid4())
    response = await client.put(f"{SCRIMS_URL}{fake_id}", json={"title": "Ghost"}, headers=auth_headers(token))
    assert response.status_code == 404


# ── DELETE /api/scrims/{id} ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_scrim(client: AsyncClient, creator_user):
    _, token = creator_user
    create_resp = await client.post(SCRIMS_URL, json=_make_scrim_payload(), headers=auth_headers(token))
    scrim_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"{SCRIMS_URL}{scrim_id}", headers=auth_headers(token))
    assert delete_resp.status_code == 204

    # Confirm it's gone
    get_resp = await client.get(f"{SCRIMS_URL}{scrim_id}", headers=auth_headers(token))
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_scrim_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    fake_id = str(uuid.uuid4())
    response = await client.delete(f"{SCRIMS_URL}{fake_id}", headers=auth_headers(token))
    assert response.status_code == 404
