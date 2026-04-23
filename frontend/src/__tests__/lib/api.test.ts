import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchScrims,
  fetchScrim,
  createScrim,
  updateScrim,
  deleteScrim,
  uploadVideo,
  getVideoUrl,
} from "@/lib/api";
import type { ScrimCreate } from "@/lib/api";

const API_URL = "http://localhost:8000";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchScrims", () => {
  it("calls correct endpoint without pagination", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await fetchScrims();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/scrims`);
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("returns success response with data", async () => {
    const mockData = [{ id: "abc", title: "Test" }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const result = await fetchScrims();
    expect(result).toEqual({ success: true, data: mockData });
  });
});

describe("fetchScrim", () => {
  it("calls correct endpoint with ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "abc123" }),
    });

    await fetchScrim("abc123");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/scrims/abc123`);
  });

  it("returns error on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not found" }),
    });

    const result = await fetchScrim("nonexistent");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("HTTP_404");
    expect(result.error?.message).toBe("Not found");
  });
});

describe("createScrim", () => {
  it("sends POST with correct body", async () => {
    const scrimData: ScrimCreate = {
      title: "My Scrim",
      language: "javascript",
      files: { "index.html": "<h1>Hi</h1>" },
      description: "A test scrim",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "new123", ...scrimData }),
    });

    await createScrim(scrimData);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/scrims`);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual(scrimData);
    expect(options.headers["Content-Type"]).toBe("application/json");
  });
});

describe("updateScrim", () => {
  it("sends PUT with correct body", async () => {
    const updateData = { title: "Updated Title", duration_ms: 5000 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "upd123", ...updateData }),
    });

    await updateScrim("upd123", updateData);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/scrims/upd123`);
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual(updateData);
  });
});

describe("deleteScrim", () => {
  it("sends DELETE with correct ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: true }),
    });

    await deleteScrim("del123");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/scrims/del123`);
    expect(options.method).toBe("DELETE");
  });

  it("returns success with deleted flag", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: true }),
    });

    const result = await deleteScrim("del123");
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

  it("includes the scrim ID in the URL", () => {
    const url = getVideoUrl("my-scrim-id");
    expect(url).toContain("my-scrim-id");
    expect(url).toBe(`${API_URL}/api/upload/video/my-scrim-id`);
  });
});

describe("API error handling", () => {
  it("returns NETWORK_ERROR on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await fetchScrims();
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

    const result = await fetchScrim("bad");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("HTTP_500");
    expect(result.error?.message).toBe("Request failed with status 500");
  });
});
