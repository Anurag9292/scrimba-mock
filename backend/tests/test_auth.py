import pytest
from tests.conftest import auth_headers


class TestRegister:
    async def test_register_first_user_becomes_admin(self, client):
        """First user registered should automatically get admin role."""
        resp = await client.post("/api/auth/register", json={
            "email": "first@test.com",
            "username": "firstuser",
            "password": "password123",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["access_token"]
        assert data["token_type"] == "bearer"
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == "first@test.com"

    async def test_register_second_user_becomes_regular(self, client):
        """Second user should get 'user' role."""
        # Create first user
        await client.post("/api/auth/register", json={
            "email": "first@test.com",
            "username": "firstuser",
            "password": "password123",
        })
        # Create second user
        resp = await client.post("/api/auth/register", json={
            "email": "second@test.com",
            "username": "seconduser",
            "password": "password123",
        })
        assert resp.status_code == 201
        assert resp.json()["user"]["role"] == "user"

    async def test_register_duplicate_email(self, client):
        await client.post("/api/auth/register", json={
            "email": "dup@test.com",
            "username": "user1",
            "password": "password123",
        })
        resp = await client.post("/api/auth/register", json={
            "email": "dup@test.com",
            "username": "user2",
            "password": "password123",
        })
        assert resp.status_code == 400
        assert "Email already registered" in resp.json()["detail"]

    async def test_register_duplicate_username(self, client):
        await client.post("/api/auth/register", json={
            "email": "a@test.com",
            "username": "sameuser",
            "password": "password123",
        })
        resp = await client.post("/api/auth/register", json={
            "email": "b@test.com",
            "username": "sameuser",
            "password": "password123",
        })
        assert resp.status_code == 400
        assert "Username already taken" in resp.json()["detail"]


class TestLogin:
    async def test_login_success(self, client):
        # Register first
        await client.post("/api/auth/register", json={
            "email": "login@test.com",
            "username": "loginuser",
            "password": "password123",
        })
        # Login
        resp = await client.post("/api/auth/login", json={
            "email": "login@test.com",
            "password": "password123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["user"]["email"] == "login@test.com"

    async def test_login_wrong_password(self, client):
        await client.post("/api/auth/register", json={
            "email": "login@test.com",
            "username": "loginuser",
            "password": "password123",
        })
        resp = await client.post("/api/auth/login", json={
            "email": "login@test.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_email(self, client):
        resp = await client.post("/api/auth/login", json={
            "email": "noone@test.com",
            "password": "password123",
        })
        assert resp.status_code == 401


class TestMe:
    async def test_get_me(self, client, admin_user):
        _, token = admin_user
        resp = await client.get("/api/auth/me", headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["email"] == "admin@test.com"

    async def test_get_me_no_auth(self, client, test_db):
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 401

    async def test_get_me_invalid_token(self, client, test_db):
        resp = await client.get("/api/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert resp.status_code == 401

    async def test_update_me(self, client, admin_user):
        _, token = admin_user
        resp = await client.put("/api/auth/me", json={"username": "newname"}, headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["username"] == "newname"


class TestRoleProtection:
    async def test_regular_user_cannot_create_scrim(self, client, regular_user):
        _, token = regular_user
        resp = await client.post("/api/scrims/", json={"title": "Test"}, headers=auth_headers(token))
        assert resp.status_code == 403

    async def test_creator_can_create_scrim(self, client, creator_user):
        _, token = creator_user
        resp = await client.post("/api/scrims/", json={"title": "Test"}, headers=auth_headers(token))
        assert resp.status_code == 201

    async def test_unauthenticated_cannot_list_scrims(self, client, test_db):
        resp = await client.get("/api/scrims/")
        assert resp.status_code == 401


class TestAdmin:
    async def test_list_users(self, client, admin_user):
        _, token = admin_user
        resp = await client.get("/api/admin/users", headers=auth_headers(token))
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_non_admin_cannot_list_users(self, client, creator_user):
        _, token = creator_user
        resp = await client.get("/api/admin/users", headers=auth_headers(token))
        assert resp.status_code == 403

    async def test_change_user_role(self, client, admin_user, regular_user):
        admin, admin_token = admin_user
        target, _ = regular_user
        resp = await client.put(
            f"/api/admin/users/{target.id}/role?role=creator",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "creator"

    async def test_cannot_demote_self(self, client, admin_user):
        admin, token = admin_user
        resp = await client.put(
            f"/api/admin/users/{admin.id}/role?role=user",
            headers=auth_headers(token),
        )
        assert resp.status_code == 400

    async def test_toggle_user_active(self, client, admin_user, regular_user):
        _, admin_token = admin_user
        target, _ = regular_user
        resp = await client.put(
            f"/api/admin/users/{target.id}/active?is_active=false",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False
