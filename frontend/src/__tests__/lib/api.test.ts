import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchLessons,
  fetchLesson,
  createLesson,
  updateLesson,
  deleteLesson,
  uploadVideo,
  getVideoUrl,
  registerUser,
  loginUser,
  fetchMe,
  updateMe,
  getGoogleOAuthUrl,
  googleOAuthCallback,
  fetchUsers,
  changeUserRole,
  toggleUserActive,
  fetchCoursePaths,
  fetchCoursePath,
  createCoursePath,
  updateCoursePath,
  deleteCoursePath,
  fetchCourses,
  fetchCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  fetchSections,
  fetchSection,
  createSection,
  updateSection,
  deleteSection,
  fetchSectionLessons,
  fetchSegments,
  createSegment,
  updateSegment as updateSegmentFn,
  deleteSegment,
  reorderSegment,
  uploadSegmentVideo,
  getSegmentVideoUrl,
  fetchCheckpoints,
  fetchLessonCheckpoints,
  createCheckpoint,
  updateCheckpoint,
  deleteCheckpoint,
  reorderCheckpoint,
  publishLesson,
  setAuthToken,
  getAuthToken,
} from "@/lib/api";
import type { LessonCreate } from "@/lib/api";

const API_URL = "http://localhost:8000";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  // Clear auth token between tests to avoid cross-test contamination
  setAuthToken(null);
});

describe("fetchLessons", () => {
  it("calls correct endpoint without pagination", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await fetchLessons();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/`);
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("returns success response with data", async () => {
    const mockData = [{ id: "abc", title: "Test" }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const result = await fetchLessons();
    expect(result).toEqual({ success: true, data: mockData });
  });
});

describe("fetchLesson", () => {
  it("calls correct endpoint with ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "abc123" }),
    });

    await fetchLesson("abc123");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/abc123`);
  });

  it("returns error on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not found" }),
    });

    const result = await fetchLesson("nonexistent");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("HTTP_404");
    expect(result.error?.message).toBe("Not found");
  });
});

describe("createLesson", () => {
  it("sends POST with correct body", async () => {
    const lessonData: LessonCreate = {
      title: "My Lesson",
      language: "javascript",
      files: { "index.html": "<h1>Hi</h1>" },
      description: "A test lesson",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "new123", ...lessonData }),
    });

    await createLesson(lessonData);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/`);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual(lessonData);
    expect(options.headers["Content-Type"]).toBe("application/json");
  });
});

describe("updateLesson", () => {
  it("sends PUT with correct body", async () => {
    const updateData = { title: "Updated Title", duration_ms: 5000 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "upd123", ...updateData }),
    });

    await updateLesson("upd123", updateData);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/upd123`);
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual(updateData);
  });
});

describe("deleteLesson", () => {
  it("sends DELETE with correct ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: true }),
    });

    await deleteLesson("del123");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/del123`);
    expect(options.method).toBe("DELETE");
  });

  it("returns success with deleted flag", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: true }),
    });

    const result = await deleteLesson("del123");
    expect(result).toEqual({ success: true, data: { deleted: true } });
  });
});

describe("uploadVideo", () => {
  it("sends POST with FormData to correct upload URL", async () => {
    const blob = new Blob(["video data"], { type: "video/webm" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "/video/vid123.webm" }),
    });

    await uploadVideo("vid123", blob);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/upload/video/vid123`);
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
  });

  it("returns error on upload failure", async () => {
    const blob = new Blob(["video data"], { type: "video/webm" });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ detail: "File too large" }),
    });

    const result = await uploadVideo("vid123", blob);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("HTTP_413");
    expect(result.error?.message).toBe("File too large");
  });
});

describe("getVideoUrl", () => {
  it("returns correct upload URL string", () => {
    const url = getVideoUrl("vid123");
    expect(url).toBe(`${API_URL}/api/upload/video/vid123`);
  });

  it("includes the lesson ID in the URL", () => {
    const url = getVideoUrl("my-lesson-id");
    expect(url).toContain("my-lesson-id");
    expect(url).toBe(`${API_URL}/api/upload/video/my-lesson-id`);
  });
});

describe("API error handling", () => {
  it("returns NETWORK_ERROR on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await fetchLessons();
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("NETWORK_ERROR");
    expect(result.error?.message).toBe("Network failure");
  });

  it("handles non-JSON error response gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });

    const result = await fetchLesson("bad");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("HTTP_500");
    expect(result.error?.message).toBe("Request failed with status 500");
  });
});

// =============================================================================
// Auth API tests
// =============================================================================

describe("Auth API", () => {
  it("registerUser sends POST to /api/auth/register", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "tok",
        token_type: "bearer",
        user: { id: "1", email: "a@b.com", username: "test", role: "admin" },
      }),
    });

    const result = await registerUser({
      email: "a@b.com",
      username: "test",
      password: "pass",
    });

    expect(result.success).toBe(true);
    expect(result.data?.access_token).toBe("tok");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/auth/register`);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      email: "a@b.com",
      username: "test",
      password: "pass",
    });
  });

  it("loginUser sends POST to /api/auth/login", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "tok",
        token_type: "bearer",
        user: { id: "1" },
      }),
    });

    const result = await loginUser({ email: "a@b.com", password: "pass" });

    expect(result.success).toBe(true);
    expect(result.data?.access_token).toBe("tok");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/auth/login`);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      email: "a@b.com",
      password: "pass",
    });
  });

  it("fetchMe sends GET to /api/auth/me", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "1", email: "a@b.com", username: "test" }),
    });

    const result = await fetchMe();

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe("1");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/auth/me`);
  });

  it("updateMe sends PUT to /api/auth/me", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "1", username: "updated" }),
    });

    const result = await updateMe({ username: "updated" });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/auth/me`);
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual({ username: "updated" });
  });

  it("getGoogleOAuthUrl sends GET with redirect_uri query param", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ url: "https://accounts.google.com/o/oauth2/..." }),
    });

    const result = await getGoogleOAuthUrl("http://localhost/callback");

    expect(result.success).toBe(true);
    expect(result.data?.url).toContain("google");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/auth/oauth/google/url");
    expect(url).toContain("redirect_uri=");
  });

  it("googleOAuthCallback sends POST to /api/auth/oauth/google", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "google-tok",
        token_type: "bearer",
        user: { id: "g1" },
      }),
    });

    const result = await googleOAuthCallback({
      code: "auth-code",
      redirect_uri: "http://localhost/callback",
    });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/auth/oauth/google`);
    expect(options.method).toBe("POST");
  });

  it("registerUser returns error on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ detail: "Email already registered" }),
    });

    const result = await registerUser({
      email: "a@b.com",
      username: "test",
      password: "pass",
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("HTTP_409");
    expect(result.error?.message).toBe("Email already registered");
  });
});

// =============================================================================
// Token management tests
// =============================================================================

describe("Token management", () => {
  it("setAuthToken stores token in localStorage", () => {
    setAuthToken("test-token-123");
    expect(getAuthToken()).toBe("test-token-123");
    expect(localStorage.getItem("auth_token")).toBe("test-token-123");
  });

  it("setAuthToken(null) clears token from localStorage", () => {
    setAuthToken("tok");
    expect(localStorage.getItem("auth_token")).toBe("tok");
    setAuthToken(null);
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("getAuthToken reads from localStorage when in-memory token is null", () => {
    // Directly set localStorage to simulate page reload scenario
    localStorage.setItem("auth_token", "persisted-token");
    // Clear in-memory token by setting null then restoring localStorage
    setAuthToken(null);
    localStorage.setItem("auth_token", "persisted-token");
    // getAuthToken should fall back to localStorage
    const token = getAuthToken();
    expect(token).toBe("persisted-token");
  });

  it("auth token is included in fetch headers when set", async () => {
    setAuthToken("my-jwt-token");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "1" }),
    });

    await fetchMe();

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Authorization"]).toBe("Bearer my-jwt-token");
  });

  it("no Authorization header when token is not set", async () => {
    setAuthToken(null);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "1" }),
    });

    await fetchMe();

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Authorization"]).toBeUndefined();
  });
});

// =============================================================================
// Admin API tests
// =============================================================================

describe("Admin API", () => {
  it("fetchUsers sends GET to /api/admin/users", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: "u1", email: "admin@test.com" }],
    });

    const result = await fetchUsers();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/admin/users`);
  });

  it("changeUserRole sends PUT with role query param", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "u1", role: "creator" }),
    });

    const result = await changeUserRole("u1", "creator");

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/admin/users/u1/role?role=creator`);
    expect(options.method).toBe("PUT");
  });

  it("toggleUserActive sends PUT with is_active query param", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "u1", is_active: false }),
    });

    const result = await toggleUserActive("u1", false);

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/admin/users/u1/active?is_active=false`);
    expect(options.method).toBe("PUT");
  });
});

// =============================================================================
// Course Path API tests
// =============================================================================

describe("Course Path API", () => {
  it("fetchCoursePaths sends GET to /api/paths/", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: "1", title: "Path" }],
    });

    const result = await fetchCoursePaths();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/paths/`);
  });

  it("fetchCoursePath sends GET to /api/paths/{id}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "p1", title: "Path One" }),
    });

    const result = await fetchCoursePath("p1");

    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("Path One");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/paths/p1`);
  });

  it("createCoursePath sends POST to /api/paths/", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: "1", title: "New Path", slug: "new-path" }),
    });

    const result = await createCoursePath({ title: "New Path" });

    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("New Path");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/paths/`);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ title: "New Path" });
  });

  it("updateCoursePath sends PUT to /api/paths/{id}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "p1", title: "Updated" }),
    });

    const result = await updateCoursePath("p1", { title: "Updated" });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/paths/p1`);
    expect(options.method).toBe("PUT");
  });

  it("deleteCoursePath sends DELETE to /api/paths/{id}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await deleteCoursePath("path-1");

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/paths/path-1`);
    expect(options.method).toBe("DELETE");
  });
});

// =============================================================================
// Course API tests
// =============================================================================

describe("Course API", () => {
  it("fetchCourses sends GET to /api/paths/{pathId}/courses/", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: "c1", title: "Course" }],
    });

    const result = await fetchCourses("path-1");

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/paths/path-1/courses/`);
  });

  it("fetchCourse sends GET to /api/paths/{pathId}/courses/{courseId}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "c1", title: "Course One" }),
    });

    const result = await fetchCourse("path-1", "c1");

    expect(result.success).toBe(true);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/paths/path-1/courses/c1`);
  });

  it("createCourse sends POST to /api/paths/{pathId}/courses/", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: "c1", title: "New Course" }),
    });

    const result = await createCourse("path-1", { title: "New Course" });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/paths/path-1/courses/`);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ title: "New Course" });
  });

  it("updateCourse sends PUT to /api/paths/{pathId}/courses/{courseId}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "c1", title: "Updated Course" }),
    });

    const result = await updateCourse("path-1", "c1", {
      title: "Updated Course",
    });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/paths/path-1/courses/c1`);
    expect(options.method).toBe("PUT");
  });

  it("deleteCourse sends DELETE to /api/paths/{pathId}/courses/{courseId}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await deleteCourse("path-1", "c1");

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/paths/path-1/courses/c1`);
    expect(options.method).toBe("DELETE");
  });
});

// =============================================================================
// Section API tests
// =============================================================================

describe("Section API", () => {
  it("fetchSections sends GET to /api/courses/{courseId}/sections/", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: "s1", title: "Section" }],
    });

    const result = await fetchSections("course-1");

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/courses/course-1/sections/`);
  });

  it("fetchSection sends GET to /api/courses/{courseId}/sections/{sectionId}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "s1", title: "Section One" }),
    });

    const result = await fetchSection("course-1", "s1");

    expect(result.success).toBe(true);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/courses/course-1/sections/s1`);
  });

  it("createSection sends POST to /api/courses/{courseId}/sections/", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: "s1", title: "New Section" }),
    });

    const result = await createSection("course-1", { title: "New Section" });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/courses/course-1/sections/`);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ title: "New Section" });
  });

  it("updateSection sends PUT to /api/courses/{courseId}/sections/{sectionId}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "s1", title: "Updated" }),
    });

    const result = await updateSection("course-1", "s1", { title: "Updated" });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/courses/course-1/sections/s1`);
    expect(options.method).toBe("PUT");
  });

  it("deleteSection sends DELETE to /api/courses/{courseId}/sections/{sectionId}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await deleteSection("course-1", "s1");

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/courses/course-1/sections/s1`);
    expect(options.method).toBe("DELETE");
  });

  it("fetchSectionLessons sends GET to /api/courses/{courseId}/sections/{sectionId}/lessons", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: "lesson-1", title: "Lesson" }],
    });

    const result = await fetchSectionLessons("course-1", "section-1");

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      `${API_URL}/api/courses/course-1/sections/section-1/lessons`
    );
  });
});

// =============================================================================
// Segment API tests
// =============================================================================

describe("Segment API", () => {
  it("fetchSegments sends GET to /api/lessons/{lessonId}/segments/", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: "seg1", order: 0 }],
    });

    const result = await fetchSegments("lesson-1");

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/lesson-1/segments/`);
  });

  it("createSegment sends POST to /api/lessons/{lessonId}/segments/", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: "seg1", order: 0 }),
    });

    const result = await createSegment("lesson-1", {
      order: 0,
      initial_files: { "index.js": "console.log('hi')" },
    });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/lesson-1/segments/`);
    expect(options.method).toBe("POST");
  });

  it("updateSegment sends PUT to /api/lessons/{lessonId}/segments/{segmentId}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "seg1", duration_ms: 5000 }),
    });

    const result = await updateSegmentFn("lesson-1", "seg1", {
      duration_ms: 5000,
    });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/lesson-1/segments/seg1`);
    expect(options.method).toBe("PUT");
  });

  it("deleteSegment sends DELETE to /api/lessons/{lessonId}/segments/{segmentId}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await deleteSegment("lesson-1", "seg1");

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/lesson-1/segments/seg1`);
    expect(options.method).toBe("DELETE");
  });

  it("reorderSegment sends PUT with new_order query param", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "seg1", order: 2 }),
    });

    const result = await reorderSegment("lesson-1", "seg1", 2);

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      `${API_URL}/api/lessons/lesson-1/segments/seg1/reorder?new_order=2`
    );
    expect(options.method).toBe("PUT");
  });

  it("uploadSegmentVideo sends POST with FormData", async () => {
    const blob = new Blob(["video data"], { type: "video/webm" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ url: "/video/seg1.webm" }),
    });

    const result = await uploadSegmentVideo("seg1", blob);

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/upload/video/segment/seg1`);
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
  });

  it("uploadSegmentVideo returns error on failure", async () => {
    const blob = new Blob(["video data"], { type: "video/webm" });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ detail: "File too large" }),
    });

    const result = await uploadSegmentVideo("seg1", blob);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("HTTP_413");
    expect(result.error?.message).toBe("File too large");
  });

  it("getSegmentVideoUrl returns correct URL", () => {
    const url = getSegmentVideoUrl("seg-123");
    expect(url).toBe(`${API_URL}/api/upload/video/segment/seg-123`);
  });
});

// =============================================================================
// Checkpoint API tests
// =============================================================================

describe("Checkpoint API", () => {
  it("fetchCheckpoints sends GET for segment checkpoints", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: "cp1", title: "Check 1" }],
    });

    const result = await fetchCheckpoints("lesson-1", "seg-1");

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      `${API_URL}/api/lessons/lesson-1/segments/seg-1/checkpoints/`
    );
  });

  it("fetchLessonCheckpoints sends GET for bulk lesson checkpoints", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const result = await fetchLessonCheckpoints("lesson-1");

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/lesson-1/checkpoints/`);
  });

  it("createCheckpoint sends POST", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: "cp1", title: "New CP", timestamp_ms: 1000 }),
    });

    const result = await createCheckpoint("lesson-1", "seg-1", {
      title: "New CP",
      timestamp_ms: 1000,
    });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      `${API_URL}/api/lessons/lesson-1/segments/seg-1/checkpoints/`
    );
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      title: "New CP",
      timestamp_ms: 1000,
    });
  });

  it("updateCheckpoint sends PUT", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "cp1", title: "Updated CP" }),
    });

    const result = await updateCheckpoint("lesson-1", "seg-1", "cp1", {
      title: "Updated CP",
    });

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      `${API_URL}/api/lessons/lesson-1/segments/seg-1/checkpoints/cp1`
    );
    expect(options.method).toBe("PUT");
  });

  it("deleteCheckpoint sends DELETE", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await deleteCheckpoint("lesson-1", "seg-1", "cp1");

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      `${API_URL}/api/lessons/lesson-1/segments/seg-1/checkpoints/cp1`
    );
    expect(options.method).toBe("DELETE");
  });

  it("reorderCheckpoint sends PUT with new_order query param", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "cp1", order: 3 }),
    });

    const result = await reorderCheckpoint("lesson-1", "seg-1", "cp1", 3);

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      `${API_URL}/api/lessons/lesson-1/segments/seg-1/checkpoints/cp1/reorder?new_order=3`
    );
    expect(options.method).toBe("PUT");
  });
});

// =============================================================================
// publishLesson tests
// =============================================================================

describe("publishLesson", () => {
  it("sends PUT to /api/lessons/{id}/publish", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "s1", status: "published" }),
    });

    const result = await publishLesson("s1");

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("published");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/lessons/s1/publish`);
    expect(options.method).toBe("PUT");
  });

  it("returns error when publish fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Lesson has no segments" }),
    });

    const result = await publishLesson("s1");

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("HTTP_400");
    expect(result.error?.message).toBe("Lesson has no segments");
  });
});

// =============================================================================
// 204 No Content handling
// =============================================================================

describe("204 No Content handling", () => {
  it("handles 204 response without calling json()", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      // No json method — 204 responses shouldn't need it
    });

    const result = await deleteCoursePath("p1");

    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });
});
