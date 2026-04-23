import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


async def _create_scrim(client: AsyncClient, token: str, title: str = "Test Scrim") -> dict:
    resp = await client.post(
        "/api/scrims/",
        json={"title": title, "status": "draft"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_segment(client: AsyncClient, token: str, scrim_id: str, **kwargs) -> dict:
    data = {
        "duration_ms": 5000,
        "code_events": [],
        "initial_files": {"index.html": "<h1>Hi</h1>"},
    }
    data.update(kwargs)
    resp = await client.post(
        f"/api/scrims/{scrim_id}/segments/",
        json=data,
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    return resp.json()


# ── POST (create segment) ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_segment(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    seg = await _create_segment(client, token, scrim["id"])
    assert seg["scrim_id"] == scrim["id"]
    assert seg["order"] == 0
    assert seg["duration_ms"] == 5000
    assert seg["initial_files"] == {"index.html": "<h1>Hi</h1>"}
    assert seg["code_events"] == []
    assert "id" in seg
    assert "created_at" in seg
    assert "updated_at" in seg


@pytest.mark.asyncio
async def test_auto_order_increment(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    s1 = await _create_segment(client, token, scrim["id"])
    s2 = await _create_segment(client, token, scrim["id"])
    s3 = await _create_segment(client, token, scrim["id"])
    assert s1["order"] == 0
    assert s2["order"] == 1
    assert s3["order"] == 2


@pytest.mark.asyncio
async def test_explicit_order(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    seg = await _create_segment(client, token, scrim["id"], order=5)
    assert seg["order"] == 5


@pytest.mark.asyncio
async def test_create_segment_scrim_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    resp = await client.post(
        "/api/scrims/00000000-0000-0000-0000-000000000000/segments/",
        json={"duration_ms": 1000, "code_events": [], "initial_files": {}},
        headers=auth_headers(token),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_regular_user_cannot_create_segment(
    client: AsyncClient, regular_user, creator_user
):
    _, creator_token = creator_user
    _, user_token = regular_user
    scrim = await _create_scrim(client, creator_token)
    resp = await client.post(
        f"/api/scrims/{scrim['id']}/segments/",
        json={"duration_ms": 1000, "code_events": [], "initial_files": {}},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 403


# ── GET (list segments) ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_segments_empty(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    resp = await client.get(
        f"/api/scrims/{scrim['id']}/segments/",
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_segments_ordered(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    await _create_segment(client, token, scrim["id"])
    await _create_segment(client, token, scrim["id"])
    resp = await client.get(
        f"/api/scrims/{scrim['id']}/segments/",
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    segments = resp.json()
    assert len(segments) == 2
    assert segments[0]["order"] == 0
    assert segments[1]["order"] == 1


@pytest.mark.asyncio
async def test_anonymous_can_list_segments(client: AsyncClient, creator_user):
    """Anonymous users can list segments (public access)."""
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    await _create_segment(client, token, scrim["id"])
    resp = await client.get(f"/api/scrims/{scrim['id']}/segments/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ── GET (single segment) ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_segment(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    seg = await _create_segment(client, token, scrim["id"])
    resp = await client.get(
        f"/api/scrims/{scrim['id']}/segments/{seg['id']}",
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == seg["id"]


@pytest.mark.asyncio
async def test_get_segment_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    resp = await client.get(
        f"/api/scrims/{scrim['id']}/segments/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(token),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_segment_wrong_scrim(client: AsyncClient, creator_user):
    """Segment must belong to the correct scrim."""
    _, token = creator_user
    scrim1 = await _create_scrim(client, token, "Scrim 1")
    scrim2 = await _create_scrim(client, token, "Scrim 2")
    seg = await _create_segment(client, token, scrim1["id"])
    resp = await client.get(
        f"/api/scrims/{scrim2['id']}/segments/{seg['id']}",
        headers=auth_headers(token),
    )
    assert resp.status_code == 404


# ── PUT (update segment) ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_segment(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    seg = await _create_segment(client, token, scrim["id"])
    resp = await client.put(
        f"/api/scrims/{scrim['id']}/segments/{seg['id']}",
        json={"duration_ms": 9999, "trim_start_ms": 100, "trim_end_ms": 5000},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["duration_ms"] == 9999
    assert data["trim_start_ms"] == 100
    assert data["trim_end_ms"] == 5000


@pytest.mark.asyncio
async def test_partial_update_segment(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    seg = await _create_segment(client, token, scrim["id"])
    resp = await client.put(
        f"/api/scrims/{scrim['id']}/segments/{seg['id']}",
        json={"duration_ms": 1234},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["duration_ms"] == 1234
    # Other fields unchanged
    assert resp.json()["trim_start_ms"] == 0


@pytest.mark.asyncio
async def test_update_segment_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    resp = await client.put(
        f"/api/scrims/{scrim['id']}/segments/00000000-0000-0000-0000-000000000000",
        json={"duration_ms": 1000},
        headers=auth_headers(token),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_regular_user_cannot_update_segment(
    client: AsyncClient, regular_user, creator_user
):
    _, creator_token = creator_user
    _, user_token = regular_user
    scrim = await _create_scrim(client, creator_token)
    seg = await _create_segment(client, creator_token, scrim["id"])
    resp = await client.put(
        f"/api/scrims/{scrim['id']}/segments/{seg['id']}",
        json={"duration_ms": 1000},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 403


# ── DELETE (delete segment) ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_segment(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    seg = await _create_segment(client, token, scrim["id"])
    resp = await client.delete(
        f"/api/scrims/{scrim['id']}/segments/{seg['id']}",
        headers=auth_headers(token),
    )
    assert resp.status_code == 204
    # Verify it's gone
    resp = await client.get(
        f"/api/scrims/{scrim['id']}/segments/",
        headers=auth_headers(token),
    )
    assert len(resp.json()) == 0


@pytest.mark.asyncio
async def test_delete_segment_reorders(client: AsyncClient, creator_user):
    """Deleting a segment shifts remaining orders down."""
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    s1 = await _create_segment(client, token, scrim["id"])
    s2 = await _create_segment(client, token, scrim["id"])
    s3 = await _create_segment(client, token, scrim["id"])
    # Delete the middle one
    await client.delete(
        f"/api/scrims/{scrim['id']}/segments/{s2['id']}",
        headers=auth_headers(token),
    )
    resp = await client.get(
        f"/api/scrims/{scrim['id']}/segments/",
        headers=auth_headers(token),
    )
    segments = resp.json()
    assert len(segments) == 2
    assert segments[0]["id"] == s1["id"]
    assert segments[0]["order"] == 0
    assert segments[1]["id"] == s3["id"]
    assert segments[1]["order"] == 1


@pytest.mark.asyncio
async def test_delete_segment_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    resp = await client.delete(
        f"/api/scrims/{scrim['id']}/segments/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(token),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_regular_user_cannot_delete_segment(
    client: AsyncClient, regular_user, creator_user
):
    _, creator_token = creator_user
    _, user_token = regular_user
    scrim = await _create_scrim(client, creator_token)
    seg = await _create_segment(client, creator_token, scrim["id"])
    resp = await client.delete(
        f"/api/scrims/{scrim['id']}/segments/{seg['id']}",
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 403


# ── PUT (reorder segment) ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_reorder_segment(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    s1 = await _create_segment(client, token, scrim["id"])
    s2 = await _create_segment(client, token, scrim["id"])
    s3 = await _create_segment(client, token, scrim["id"])
    # Move s3 to position 0
    resp = await client.put(
        f"/api/scrims/{scrim['id']}/segments/{s3['id']}/reorder?new_order=0",
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["order"] == 0
    # Check full order
    resp = await client.get(
        f"/api/scrims/{scrim['id']}/segments/",
        headers=auth_headers(token),
    )
    segments = resp.json()
    assert segments[0]["id"] == s3["id"]
    assert segments[1]["id"] == s1["id"]
    assert segments[2]["id"] == s2["id"]


@pytest.mark.asyncio
async def test_reorder_segment_same_position(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    seg = await _create_segment(client, token, scrim["id"])
    resp = await client.put(
        f"/api/scrims/{scrim['id']}/segments/{seg['id']}/reorder?new_order=0",
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["order"] == 0


@pytest.mark.asyncio
async def test_reorder_segment_move_down(client: AsyncClient, creator_user):
    """Move first segment to last position."""
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    s1 = await _create_segment(client, token, scrim["id"])
    s2 = await _create_segment(client, token, scrim["id"])
    s3 = await _create_segment(client, token, scrim["id"])
    # Move s1 to position 2
    resp = await client.put(
        f"/api/scrims/{scrim['id']}/segments/{s1['id']}/reorder?new_order=2",
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["order"] == 2
    # Check full order
    resp = await client.get(
        f"/api/scrims/{scrim['id']}/segments/",
        headers=auth_headers(token),
    )
    segments = resp.json()
    assert segments[0]["id"] == s2["id"]
    assert segments[1]["id"] == s3["id"]
    assert segments[2]["id"] == s1["id"]


@pytest.mark.asyncio
async def test_reorder_segment_not_found(client: AsyncClient, creator_user):
    _, token = creator_user
    scrim = await _create_scrim(client, token)
    resp = await client.put(
        f"/api/scrims/{scrim['id']}/segments/00000000-0000-0000-0000-000000000000/reorder?new_order=0",
        headers=auth_headers(token),
    )
    assert resp.status_code == 404
