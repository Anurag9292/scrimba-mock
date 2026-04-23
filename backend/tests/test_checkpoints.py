import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


LESSONS_URL = "/api/lessons/"


def _make_lesson_payload(**overrides) -> dict:
    defaults = {
        "title": "Test Lesson",
        "language": "html",
        "status": "draft",
    }
    defaults.update(overrides)
    return defaults


def _make_segment_payload(**overrides) -> dict:
    defaults = {
        "duration_ms": 10000,
        "code_events": [],
        "initial_files": {"index.html": "<h1>Hello</h1>"},
    }
    defaults.update(overrides)
    return defaults


def _make_checkpoint_payload(**overrides) -> dict:
    defaults = {
        "timestamp_ms": 5000,
        "title": "Add a heading",
        "instructions": "Add an h1 tag with the text 'Hello World'",
        "validation_type": "output_match",
        "validation_config": {"expected_output": "Hello World"},
    }
    defaults.update(overrides)
    return defaults


async def _create_lesson_and_segment(client: AsyncClient, token: str) -> tuple[str, str]:
    """Helper: create a lesson and a segment, return (lesson_id, segment_id)."""
    headers = auth_headers(token)
    lesson_resp = await client.post(LESSONS_URL, json=_make_lesson_payload(), headers=headers)
    lesson_id = lesson_resp.json()["id"]

    seg_resp = await client.post(
        f"{LESSONS_URL}{lesson_id}/segments/",
        json=_make_segment_payload(),
        headers=headers,
    )
    segment_id = seg_resp.json()["id"]
    return lesson_id, segment_id


def _checkpoints_url(lesson_id: str, segment_id: str) -> str:
    return f"{LESSONS_URL}{lesson_id}/segments/{segment_id}/checkpoints/"


def _checkpoint_url(lesson_id: str, segment_id: str, checkpoint_id: str) -> str:
    return f"{LESSONS_URL}{lesson_id}/segments/{segment_id}/checkpoints/{checkpoint_id}"


# ── POST (create checkpoint) ────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_checkpoint_returns_201(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)
    payload = _make_checkpoint_payload()

    response = await client.post(
        _checkpoints_url(lesson_id, segment_id), json=payload, headers=headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["instructions"] == payload["instructions"]
    assert data["timestamp_ms"] == payload["timestamp_ms"]
    assert data["validation_type"] == "output_match"
    assert data["validation_config"] == payload["validation_config"]
    assert data["segment_id"] == segment_id
    assert data["order"] == 0
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_checkpoint_auto_assigns_order(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)

    # Create first checkpoint
    resp1 = await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(title="First"),
        headers=headers,
    )
    assert resp1.json()["order"] == 0

    # Create second checkpoint — should auto-assign order 1
    resp2 = await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(title="Second", timestamp_ms=8000),
        headers=headers,
    )
    assert resp2.json()["order"] == 1


@pytest.mark.asyncio
async def test_create_checkpoint_with_explicit_order(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)

    response = await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(order=5),
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["order"] == 5


@pytest.mark.asyncio
async def test_create_checkpoint_invalid_segment_returns_404(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_resp = await client.post(LESSONS_URL, json=_make_lesson_payload(), headers=headers)
    lesson_id = lesson_resp.json()["id"]
    fake_segment_id = str(uuid.uuid4())

    response = await client.post(
        _checkpoints_url(lesson_id, fake_segment_id),
        json=_make_checkpoint_payload(),
        headers=headers,
    )
    assert response.status_code == 404


# ── GET (list checkpoints) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_checkpoints_empty(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)

    response = await client.get(_checkpoints_url(lesson_id, segment_id), headers=headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_checkpoints_with_data(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)

    await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(title="First"),
        headers=headers,
    )
    await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(title="Second", timestamp_ms=8000),
        headers=headers,
    )

    response = await client.get(_checkpoints_url(lesson_id, segment_id), headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["title"] == "First"
    assert data[1]["title"] == "Second"


# ── GET (single checkpoint) ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_checkpoint_by_id(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)

    create_resp = await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(),
        headers=headers,
    )
    checkpoint_id = create_resp.json()["id"]

    response = await client.get(
        _checkpoint_url(lesson_id, segment_id, checkpoint_id), headers=headers
    )
    assert response.status_code == 200
    assert response.json()["id"] == checkpoint_id
    assert response.json()["title"] == "Add a heading"


@pytest.mark.asyncio
async def test_get_checkpoint_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)
    fake_id = str(uuid.uuid4())

    response = await client.get(
        _checkpoint_url(lesson_id, segment_id, fake_id), headers=headers
    )
    assert response.status_code == 404


# ── PUT (update checkpoint) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_checkpoint(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)

    create_resp = await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(),
        headers=headers,
    )
    checkpoint_id = create_resp.json()["id"]

    update_payload = {
        "title": "Updated Title",
        "instructions": "New instructions",
        "timestamp_ms": 7000,
    }
    response = await client.put(
        _checkpoint_url(lesson_id, segment_id, checkpoint_id),
        json=update_payload,
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["instructions"] == "New instructions"
    assert data["timestamp_ms"] == 7000
    # Unchanged fields should remain
    assert data["validation_type"] == "output_match"


@pytest.mark.asyncio
async def test_update_checkpoint_partial(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)

    create_resp = await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(),
        headers=headers,
    )
    checkpoint_id = create_resp.json()["id"]
    original = create_resp.json()

    response = await client.put(
        _checkpoint_url(lesson_id, segment_id, checkpoint_id),
        json={"title": "Only title changed"},
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Only title changed"
    assert data["instructions"] == original["instructions"]
    assert data["timestamp_ms"] == original["timestamp_ms"]


@pytest.mark.asyncio
async def test_update_checkpoint_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)
    fake_id = str(uuid.uuid4())

    response = await client.put(
        _checkpoint_url(lesson_id, segment_id, fake_id),
        json={"title": "Ghost"},
        headers=headers,
    )
    assert response.status_code == 404


# ── DELETE (delete checkpoint) ───────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_checkpoint(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)

    create_resp = await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(),
        headers=headers,
    )
    checkpoint_id = create_resp.json()["id"]

    delete_resp = await client.delete(
        _checkpoint_url(lesson_id, segment_id, checkpoint_id), headers=headers
    )
    assert delete_resp.status_code == 204

    # Confirm it's gone
    get_resp = await client.get(
        _checkpoint_url(lesson_id, segment_id, checkpoint_id), headers=headers
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_checkpoint_reorders_remaining(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)

    # Create three checkpoints
    resp1 = await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(title="First", timestamp_ms=2000),
        headers=headers,
    )
    resp2 = await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(title="Second", timestamp_ms=5000),
        headers=headers,
    )
    resp3 = await client.post(
        _checkpoints_url(lesson_id, segment_id),
        json=_make_checkpoint_payload(title="Third", timestamp_ms=8000),
        headers=headers,
    )

    # Delete the first checkpoint (order=0)
    first_id = resp1.json()["id"]
    await client.delete(_checkpoint_url(lesson_id, segment_id, first_id), headers=headers)

    # Remaining checkpoints should have been re-ordered
    list_resp = await client.get(_checkpoints_url(lesson_id, segment_id), headers=headers)
    data = list_resp.json()
    assert len(data) == 2
    assert data[0]["title"] == "Second"
    assert data[0]["order"] == 0
    assert data[1]["title"] == "Third"
    assert data[1]["order"] == 1


@pytest.mark.asyncio
async def test_delete_checkpoint_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_id, segment_id = await _create_lesson_and_segment(client, token)
    fake_id = str(uuid.uuid4())

    response = await client.delete(
        _checkpoint_url(lesson_id, segment_id, fake_id), headers=headers
    )
    assert response.status_code == 404


# ── GET (bulk fetch lesson checkpoints) ──────────────────────────────

@pytest.mark.asyncio
async def test_list_lesson_checkpoints(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_resp = await client.post(LESSONS_URL, json=_make_lesson_payload(), headers=headers)
    lesson_id = lesson_resp.json()["id"]

    # Create two segments
    seg1_resp = await client.post(
        f"{LESSONS_URL}{lesson_id}/segments/",
        json=_make_segment_payload(),
        headers=headers,
    )
    seg1_id = seg1_resp.json()["id"]

    seg2_resp = await client.post(
        f"{LESSONS_URL}{lesson_id}/segments/",
        json=_make_segment_payload(),
        headers=headers,
    )
    seg2_id = seg2_resp.json()["id"]

    # Create checkpoints in each segment
    await client.post(
        _checkpoints_url(lesson_id, seg1_id),
        json=_make_checkpoint_payload(title="Seg1 CP1"),
        headers=headers,
    )
    await client.post(
        _checkpoints_url(lesson_id, seg2_id),
        json=_make_checkpoint_payload(title="Seg2 CP1"),
        headers=headers,
    )
    await client.post(
        _checkpoints_url(lesson_id, seg2_id),
        json=_make_checkpoint_payload(title="Seg2 CP2", timestamp_ms=8000),
        headers=headers,
    )

    # Bulk fetch all checkpoints for the lesson
    response = await client.get(f"{LESSONS_URL}{lesson_id}/checkpoints/", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    titles = [cp["title"] for cp in data]
    assert "Seg1 CP1" in titles
    assert "Seg2 CP1" in titles
    assert "Seg2 CP2" in titles


@pytest.mark.asyncio
async def test_list_lesson_checkpoints_empty(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    lesson_resp = await client.post(LESSONS_URL, json=_make_lesson_payload(), headers=headers)
    lesson_id = lesson_resp.json()["id"]

    response = await client.get(f"{LESSONS_URL}{lesson_id}/checkpoints/", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_lesson_checkpoints_invalid_lesson(client: AsyncClient, creator_user):
    _, token = creator_user
    headers = auth_headers(token)
    fake_id = str(uuid.uuid4())
    response = await client.get(f"{LESSONS_URL}{fake_id}/checkpoints/", headers=headers)
    assert response.status_code == 404
