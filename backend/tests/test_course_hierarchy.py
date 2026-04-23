import pytest
from tests.conftest import auth_headers


async def _create_path(client, token, title="Test Path"):
    resp = await client.post(
        "/api/paths/",
        json={"title": title},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_course(client, token, path_id, title="Test Course"):
    resp = await client.post(
        f"/api/paths/{path_id}/courses/",
        json={"title": title},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_section(client, token, course_id, title="Test Section"):
    resp = await client.post(
        f"/api/courses/{course_id}/sections/",
        json={"title": title},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    return resp.json()


class TestCoursePaths:
    async def test_create_path(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        assert path["title"] == "Test Path"
        assert path["slug"] == "test-path"
        assert path["status"] == "draft"
        assert path["order"] == 0

    async def test_list_paths(self, client, creator_user):
        _, token = creator_user
        await _create_path(client, token, "Path 1")
        await _create_path(client, token, "Path 2")
        resp = await client.get("/api/paths/", headers=auth_headers(token))
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_get_path(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        resp = await client.get(f"/api/paths/{path['id']}", headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["title"] == "Test Path"

    async def test_update_path(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        resp = await client.put(
            f"/api/paths/{path['id']}",
            json={"title": "Updated Path"},
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Path"

    async def test_delete_path(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        resp = await client.delete(f"/api/paths/{path['id']}", headers=auth_headers(token))
        assert resp.status_code == 204

    async def test_slug_auto_generation(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token, "AI Engineer Path!")
        assert path["slug"] == "ai-engineer-path"

    async def test_slug_uniqueness(self, client, creator_user):
        _, token = creator_user
        p1 = await _create_path(client, token, "Same Name")
        p2 = await _create_path(client, token, "Same Name")
        assert p1["slug"] == "same-name"
        assert p2["slug"] == "same-name-1"

    async def test_reorder_path(self, client, creator_user):
        _, token = creator_user
        p1 = await _create_path(client, token, "First")
        p2 = await _create_path(client, token, "Second")
        p3 = await _create_path(client, token, "Third")
        # Move third to position 0
        resp = await client.put(
            f"/api/paths/{p3['id']}/reorder?new_order=0",
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["order"] == 0

    async def test_regular_user_cannot_create_path(self, client, regular_user):
        _, token = regular_user
        resp = await client.post(
            "/api/paths/",
            json={"title": "Forbidden"},
            headers=auth_headers(token),
        )
        assert resp.status_code == 403


class TestCourses:
    async def test_create_course(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        course = await _create_course(client, token, path["id"])
        assert course["title"] == "Test Course"
        assert course["slug"] == "test-course"

    async def test_list_courses(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        await _create_course(client, token, path["id"], "Course 1")
        await _create_course(client, token, path["id"], "Course 2")
        resp = await client.get(f"/api/paths/{path['id']}/courses/", headers=auth_headers(token))
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_update_course(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        course = await _create_course(client, token, path["id"])
        resp = await client.put(
            f"/api/paths/{path['id']}/courses/{course['id']}",
            json={"title": "Updated Course"},
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Course"

    async def test_delete_course(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        course = await _create_course(client, token, path["id"])
        resp = await client.delete(
            f"/api/paths/{path['id']}/courses/{course['id']}",
            headers=auth_headers(token),
        )
        assert resp.status_code == 204

    async def test_course_not_found(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        resp = await client.get(
            f"/api/paths/{path['id']}/courses/00000000-0000-0000-0000-000000000000",
            headers=auth_headers(token),
        )
        assert resp.status_code == 404


class TestSections:
    async def test_create_section(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        course = await _create_course(client, token, path["id"])
        section = await _create_section(client, token, course["id"])
        assert section["title"] == "Test Section"
        assert section["order"] == 0

    async def test_list_sections(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        course = await _create_course(client, token, path["id"])
        await _create_section(client, token, course["id"], "Section 1")
        await _create_section(client, token, course["id"], "Section 2")
        resp = await client.get(f"/api/courses/{course['id']}/sections/", headers=auth_headers(token))
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_update_section(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        course = await _create_course(client, token, path["id"])
        section = await _create_section(client, token, course["id"])
        resp = await client.put(
            f"/api/courses/{course['id']}/sections/{section['id']}",
            json={"title": "Updated Section"},
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Section"

    async def test_delete_section(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        course = await _create_course(client, token, path["id"])
        section = await _create_section(client, token, course["id"])
        resp = await client.delete(
            f"/api/courses/{course['id']}/sections/{section['id']}",
            headers=auth_headers(token),
        )
        assert resp.status_code == 204

    async def test_reorder_sections(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        course = await _create_course(client, token, path["id"])
        s1 = await _create_section(client, token, course["id"], "First")
        s2 = await _create_section(client, token, course["id"], "Second")
        s3 = await _create_section(client, token, course["id"], "Third")
        resp = await client.put(
            f"/api/courses/{course['id']}/sections/{s3['id']}/reorder?new_order=0",
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["order"] == 0

    async def test_list_section_lessons(self, client, creator_user):
        _, token = creator_user
        path = await _create_path(client, token)
        course = await _create_course(client, token, path["id"])
        section = await _create_section(client, token, course["id"])

        # Create a lesson with section_id
        resp = await client.post("/api/lessons/", json={
            "title": "Lesson in section",
            "section_id": section["id"],
        }, headers=auth_headers(token))
        assert resp.status_code == 201

        # List lessons in the section
        resp = await client.get(
            f"/api/courses/{course['id']}/sections/{section['id']}/lessons",
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        lessons = resp.json()
        assert len(lessons) == 1
        assert lessons[0]["title"] == "Lesson in section"
