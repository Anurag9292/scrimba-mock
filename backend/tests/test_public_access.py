import pytest
from tests.conftest import auth_headers


async def _setup_hierarchy(client, token):
    """Create a full path > course > section > scrim hierarchy and return all IDs."""
    # Create path
    resp = await client.post("/api/paths/", json={"title": "Public Path", "status": "published"}, headers=auth_headers(token))
    assert resp.status_code == 201
    path = resp.json()

    # Create course
    resp = await client.post(f"/api/paths/{path['id']}/courses/", json={"title": "Public Course", "status": "published"}, headers=auth_headers(token))
    assert resp.status_code == 201
    course = resp.json()

    # Create section
    resp = await client.post(f"/api/courses/{course['id']}/sections/", json={"title": "Public Section"}, headers=auth_headers(token))
    assert resp.status_code == 201
    section = resp.json()

    # Create published scrim in section
    resp = await client.post("/api/scrims/", json={"title": "Public Scrim", "status": "published", "section_id": section["id"]}, headers=auth_headers(token))
    assert resp.status_code == 201
    scrim = resp.json()

    # Create draft scrim (should not be visible to anonymous)
    resp = await client.post("/api/scrims/", json={"title": "Draft Scrim", "status": "draft"}, headers=auth_headers(token))
    assert resp.status_code == 201
    draft_scrim = resp.json()

    return {"path": path, "course": course, "section": section, "scrim": scrim, "draft_scrim": draft_scrim}


class TestAnonymousPathAccess:
    async def test_list_published_paths(self, client, creator_user):
        _, token = creator_user
        await _setup_hierarchy(client, token)
        # Also create a draft path
        await client.post("/api/paths/", json={"title": "Draft Path", "status": "draft"}, headers=auth_headers(token))

        resp = await client.get("/api/paths/")
        assert resp.status_code == 200
        paths = resp.json()
        # Should only see published paths
        assert all(p["status"] == "published" for p in paths)
        assert any(p["title"] == "Public Path" for p in paths)

    async def test_get_published_path(self, client, creator_user):
        _, token = creator_user
        data = await _setup_hierarchy(client, token)
        resp = await client.get(f"/api/paths/{data['path']['id']}")
        assert resp.status_code == 200

    async def test_get_draft_path_anonymous_404(self, client, creator_user):
        _, token = creator_user
        resp = await client.post("/api/paths/", json={"title": "Draft", "status": "draft"}, headers=auth_headers(token))
        path = resp.json()
        # Anonymous can't see draft
        resp = await client.get(f"/api/paths/{path['id']}")
        assert resp.status_code == 404

    async def test_slug_lookup(self, client, creator_user):
        _, token = creator_user
        await _setup_hierarchy(client, token)
        resp = await client.get("/api/paths/by-slug/public-path")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Public Path"

    async def test_slug_lookup_not_found(self, client, creator_user):
        resp = await client.get("/api/paths/by-slug/nonexistent")
        assert resp.status_code == 404


class TestAnonymousCourseAccess:
    async def test_list_courses(self, client, creator_user):
        _, token = creator_user
        data = await _setup_hierarchy(client, token)
        resp = await client.get(f"/api/paths/{data['path']['id']}/courses/")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_get_course_direct(self, client, creator_user):
        _, token = creator_user
        data = await _setup_hierarchy(client, token)
        resp = await client.get(f"/api/courses/{data['course']['id']}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Public Course"


class TestAnonymousSectionAccess:
    async def test_list_sections(self, client, creator_user):
        _, token = creator_user
        data = await _setup_hierarchy(client, token)
        resp = await client.get(f"/api/courses/{data['course']['id']}/sections/")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_list_section_scrims(self, client, creator_user):
        _, token = creator_user
        data = await _setup_hierarchy(client, token)
        resp = await client.get(f"/api/courses/{data['course']['id']}/sections/{data['section']['id']}/scrims")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


class TestAnonymousScrimAccess:
    async def test_list_published_scrims(self, client, creator_user):
        _, token = creator_user
        data = await _setup_hierarchy(client, token)
        resp = await client.get("/api/scrims/")
        assert resp.status_code == 200
        scrims = resp.json()
        # All should be published
        assert all(s["status"] == "published" for s in scrims)

    async def test_get_published_scrim(self, client, creator_user):
        _, token = creator_user
        data = await _setup_hierarchy(client, token)
        resp = await client.get(f"/api/scrims/{data['scrim']['id']}")
        assert resp.status_code == 200

    async def test_get_draft_scrim_anonymous_404(self, client, creator_user):
        _, token = creator_user
        data = await _setup_hierarchy(client, token)
        resp = await client.get(f"/api/scrims/{data['draft_scrim']['id']}")
        assert resp.status_code == 404

    async def test_anonymous_cannot_create_scrim(self, client, test_db):
        resp = await client.post("/api/scrims/", json={"title": "Hack"})
        assert resp.status_code == 401

    async def test_anonymous_cannot_delete_scrim(self, client, creator_user):
        _, token = creator_user
        data = await _setup_hierarchy(client, token)
        resp = await client.delete(f"/api/scrims/{data['scrim']['id']}")
        assert resp.status_code == 401
