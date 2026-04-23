import pytest
from tests.conftest import auth_headers


class TestPublishLesson:
    async def test_publish(self, client, creator_user):
        _, token = creator_user
        resp = await client.post("/api/lessons/", json={"title": "Draft", "status": "draft"}, headers=auth_headers(token))
        lesson = resp.json()
        assert lesson["status"] == "draft"

        resp = await client.put(f"/api/lessons/{lesson['id']}/publish", headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "published"

    async def test_publish_already_published(self, client, creator_user):
        _, token = creator_user
        resp = await client.post("/api/lessons/", json={"title": "Pub", "status": "published"}, headers=auth_headers(token))
        lesson = resp.json()

        resp = await client.put(f"/api/lessons/{lesson['id']}/publish", headers=auth_headers(token))
        assert resp.status_code == 400
        assert "already published" in resp.json()["detail"]

    async def test_publish_not_found(self, client, creator_user):
        _, token = creator_user
        resp = await client.put(
            "/api/lessons/00000000-0000-0000-0000-000000000000/publish",
            headers=auth_headers(token),
        )
        assert resp.status_code == 404


class TestLessonCascadeDelete:
    async def test_delete_lesson_with_segments(self, client, creator_user):
        """Deleting a lesson should cascade delete its segments."""
        _, token = creator_user
        # Create lesson
        resp = await client.post("/api/lessons/", json={"title": "Cascade Test", "status": "draft"}, headers=auth_headers(token))
        lesson = resp.json()

        # Add segments
        await client.post(
            f"/api/lessons/{lesson['id']}/segments/",
            json={"duration_ms": 1000, "code_events": [], "initial_files": {}},
            headers=auth_headers(token),
        )
        await client.post(
            f"/api/lessons/{lesson['id']}/segments/",
            json={"duration_ms": 2000, "code_events": [], "initial_files": {}},
            headers=auth_headers(token),
        )

        # Verify segments exist
        resp = await client.get(f"/api/lessons/{lesson['id']}/segments/", headers=auth_headers(token))
        assert len(resp.json()) == 2

        # Delete lesson
        resp = await client.delete(f"/api/lessons/{lesson['id']}", headers=auth_headers(token))
        assert resp.status_code == 204


class TestLessonWithSectionId:
    async def test_create_lesson_with_section(self, client, creator_user):
        _, token = creator_user
        # Create hierarchy
        resp = await client.post("/api/paths/", json={"title": "P"}, headers=auth_headers(token))
        path = resp.json()
        resp = await client.post(f"/api/paths/{path['id']}/courses/", json={"title": "C"}, headers=auth_headers(token))
        course = resp.json()
        resp = await client.post(f"/api/courses/{course['id']}/sections/", json={"title": "S"}, headers=auth_headers(token))
        section = resp.json()

        # Create lesson with section_id
        resp = await client.post("/api/lessons/", json={
            "title": "Linked Lesson",
            "section_id": section["id"],
            "status": "draft",
        }, headers=auth_headers(token))
        assert resp.status_code == 201
        assert resp.json()["section_id"] == section["id"]

    async def test_lesson_status_filter(self, client, creator_user):
        _, token = creator_user
        await client.post("/api/lessons/", json={"title": "Draft 1", "status": "draft"}, headers=auth_headers(token))
        await client.post("/api/lessons/", json={"title": "Pub 1", "status": "published"}, headers=auth_headers(token))

        # Filter by draft
        resp = await client.get("/api/lessons/?status=draft", headers=auth_headers(token))
        assert resp.status_code == 200
        assert all(s["status"] == "draft" for s in resp.json())

        # Filter by published
        resp = await client.get("/api/lessons/?status=published", headers=auth_headers(token))
        assert resp.status_code == 200
        assert all(s["status"] == "published" for s in resp.json())


class TestCourseReorder:
    async def test_reorder_course(self, client, creator_user):
        _, token = creator_user
        resp = await client.post("/api/paths/", json={"title": "Path"}, headers=auth_headers(token))
        path = resp.json()

        resp = await client.post(f"/api/paths/{path['id']}/courses/", json={"title": "C1"}, headers=auth_headers(token))
        c1 = resp.json()
        resp = await client.post(f"/api/paths/{path['id']}/courses/", json={"title": "C2"}, headers=auth_headers(token))
        c2 = resp.json()
        resp = await client.post(f"/api/paths/{path['id']}/courses/", json={"title": "C3"}, headers=auth_headers(token))
        c3 = resp.json()

        # Move C3 to position 0
        resp = await client.put(
            f"/api/paths/{path['id']}/courses/{c3['id']}/reorder?new_order=0",
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["order"] == 0

    async def test_course_direct_lookup(self, client, creator_user):
        _, token = creator_user
        resp = await client.post("/api/paths/", json={"title": "Path"}, headers=auth_headers(token))
        path = resp.json()
        resp = await client.post(f"/api/paths/{path['id']}/courses/", json={"title": "Lookup Course"}, headers=auth_headers(token))
        course = resp.json()

        # Direct lookup via /api/courses/{id}
        resp = await client.get(f"/api/courses/{course['id']}", headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["title"] == "Lookup Course"

    async def test_course_direct_lookup_not_found(self, client, creator_user):
        _, token = creator_user
        resp = await client.get(
            "/api/courses/00000000-0000-0000-0000-000000000000",
            headers=auth_headers(token),
        )
        assert resp.status_code == 404


class TestAdminEdgeCases:
    async def test_change_role_invalid(self, client, admin_user):
        _, token = admin_user
        resp = await client.get("/api/admin/users", headers=auth_headers(token))
        user_id = resp.json()[0]["id"]
        resp = await client.put(
            f"/api/admin/users/{user_id}/role?role=superadmin",
            headers=auth_headers(token),
        )
        assert resp.status_code == 400
        assert "Invalid role" in resp.json()["detail"]

    async def test_change_role_user_not_found(self, client, admin_user):
        _, token = admin_user
        resp = await client.put(
            "/api/admin/users/00000000-0000-0000-0000-000000000000/role?role=creator",
            headers=auth_headers(token),
        )
        assert resp.status_code == 404

    async def test_toggle_active_not_found(self, client, admin_user):
        _, token = admin_user
        resp = await client.put(
            "/api/admin/users/00000000-0000-0000-0000-000000000000/active?is_active=false",
            headers=auth_headers(token),
        )
        assert resp.status_code == 404

    async def test_cannot_deactivate_self(self, client, admin_user):
        admin, token = admin_user
        resp = await client.put(
            f"/api/admin/users/{admin.id}/active?is_active=false",
            headers=auth_headers(token),
        )
        assert resp.status_code == 400
        assert "Cannot deactivate" in resp.json()["detail"]


class TestAuthEdgeCases:
    async def test_login_deactivated_user(self, client, admin_user, regular_user):
        admin, admin_token = admin_user
        target, _ = regular_user

        # Deactivate the user
        await client.put(
            f"/api/admin/users/{target.id}/active?is_active=false",
            headers=auth_headers(admin_token),
        )

        # Try to login
        resp = await client.post("/api/auth/login", json={
            "email": "user@test.com",
            "password": "password123",
        })
        assert resp.status_code == 403
        assert "deactivated" in resp.json()["detail"]

    async def test_update_me_duplicate_username(self, client, admin_user, regular_user):
        _, admin_token = admin_user
        _, user_token = regular_user

        resp = await client.put(
            "/api/auth/me",
            json={"username": "admin"},  # admin's username
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 400
        assert "Username already taken" in resp.json()["detail"]

    async def test_google_oauth_url_not_configured(self, client, test_db):
        resp = await client.get("/api/auth/oauth/google/url?redirect_uri=http://localhost:3000/auth/callback")
        assert resp.status_code == 501
        assert "not configured" in resp.json()["detail"]

    async def test_google_oauth_callback_not_configured(self, client, test_db):
        resp = await client.post("/api/auth/oauth/google", json={
            "code": "fake-code",
            "redirect_uri": "http://localhost:3000/auth/callback",
        })
        assert resp.status_code == 501
