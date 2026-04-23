import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchScrims,
  fetchScrim,
  createScrim,
  deleteScrim,
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
  it("calls correct endpoint with default pagination", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 20, hasMore: false }),
    });

    await fetchScrims();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/scrims?page=1&pageSize=20`);
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("calls correct endpoint with custom pagination", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 2, pageSize: 10, hasMore: false }),
    });

    await fetchScrims(2, 10);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/scrims?page=2&pageSize=10`);
  });

  it("returns success response with data", async () => {
    const mockData = { items: [], total: 0, page: 1, pageSize: 20, hasMore: false };
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
      initialFiles: { "index.html": "<h1>Hi</h1>" },
      description: "A test scrim",
      tags: ["test"],
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

describe("getVideoUrl", () => {
  it("returns correct URL string", () => {
    const url = getVideoUrl("vid123");
    expect(url).toBe(`${API_URL}/api/scrims/vid123/video`);
  });

  it("includes the scrim ID in the URL", () => {
    const url = getVideoUrl("my-scrim-id");
    expect(url).toContain("my-scrim-id");
    expect(url).toBe(`${API_URL}/api/scrims/my-scrim-id/video`);
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
