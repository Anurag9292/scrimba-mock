import type { Scrim, ScrimSegment, ApiResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Data required to create a new scrim */
export interface ScrimCreate {
  title: string;
  description?: string;
  language?: string;
  initial_code?: string;
  code_events?: Array<Record<string, unknown>>;
  files?: Record<string, string>;
  duration_ms?: number;
  status?: "draft" | "published";
}

/** Data required to create a new segment */
export interface SegmentCreate {
  order?: number;
  duration_ms?: number;
  code_events?: Array<Record<string, unknown>>;
  initial_files?: Record<string, string>;
}

/** Data for updating a segment */
export interface SegmentUpdate {
  order?: number;
  duration_ms?: number;
  code_events?: Array<Record<string, unknown>>;
  initial_files?: Record<string, string>;
  trim_start_ms?: number;
  trim_end_ms?: number | null;
}

/** Data for updating an existing scrim */
export interface ScrimUpdate {
  title?: string;
  description?: string;
  duration_ms?: number;
  initial_code?: string;
  language?: string;
  code_events?: Array<Record<string, unknown>>;
  files?: Record<string, string>;
}

/** Generic fetch wrapper with error handling */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${path}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message:
            errorBody?.detail ??
            errorBody?.message ??
            `Request failed with status ${response.status}`,
        },
      };
    }

    // 204 No Content has no body
    if (response.status === 204) {
      return { success: true, data: undefined as unknown as T };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message:
          err instanceof Error ? err.message : "An unknown error occurred",
      },
    };
  }
}

/** Fetch all scrims, optionally filtered by status */
export async function fetchScrims(
  status?: "draft" | "published"
): Promise<ApiResponse<Scrim[]>> {
  const query = status ? `?status=${status}` : "";
  return apiFetch<Scrim[]>(`/api/scrims/${query}`);
}

/** Fetch a single scrim by ID */
export async function fetchScrim(id: string): Promise<ApiResponse<Scrim>> {
  return apiFetch<Scrim>(`/api/scrims/${id}`);
}

/** Create a new scrim */
export async function createScrim(
  data: ScrimCreate
): Promise<ApiResponse<Scrim>> {
  return apiFetch<Scrim>("/api/scrims/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update an existing scrim */
export async function updateScrim(
  id: string,
  data: ScrimUpdate
): Promise<ApiResponse<Scrim>> {
  return apiFetch<Scrim>(`/api/scrims/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Delete a scrim */
export async function deleteScrim(
  id: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiFetch<{ deleted: boolean }>(`/api/scrims/${id}`, {
    method: "DELETE",
  });
}

/** Upload audio/video for a scrim */
export async function uploadVideo(
  scrimId: string,
  videoBlob: Blob
): Promise<ApiResponse<{ url: string }>> {
  const url = `${API_URL}/api/upload/video/${scrimId}`;
  const formData = new FormData();
  formData.append("file", videoBlob, "recording.webm");

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message:
            errorBody?.detail ??
            errorBody?.message ??
            `Upload failed with status ${response.status}`,
        },
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message:
          err instanceof Error ? err.message : "Upload failed unexpectedly",
      },
    };
  }
}

/** Get the URL for a scrim's video/audio recording */
export function getVideoUrl(scrimId: string): string {
  return `${API_URL}/api/upload/video/${scrimId}`;
}

/** Publish a draft scrim */
export async function publishScrim(
  scrimId: string
): Promise<ApiResponse<Scrim>> {
  return apiFetch<Scrim>(`/api/scrims/${scrimId}/publish`, {
    method: "PUT",
  });
}

// --- Segment API ---

/** Fetch all segments for a scrim */
export async function fetchSegments(
  scrimId: string
): Promise<ApiResponse<ScrimSegment[]>> {
  return apiFetch<ScrimSegment[]>(`/api/scrims/${scrimId}/segments/`);
}

/** Create a new segment for a scrim */
export async function createSegment(
  scrimId: string,
  data: SegmentCreate
): Promise<ApiResponse<ScrimSegment>> {
  return apiFetch<ScrimSegment>(`/api/scrims/${scrimId}/segments/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update an existing segment */
export async function updateSegment(
  scrimId: string,
  segmentId: string,
  data: SegmentUpdate
): Promise<ApiResponse<ScrimSegment>> {
  return apiFetch<ScrimSegment>(
    `/api/scrims/${scrimId}/segments/${segmentId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

/** Delete a segment */
export async function deleteSegment(
  scrimId: string,
  segmentId: string
): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/scrims/${scrimId}/segments/${segmentId}`, {
    method: "DELETE",
  });
}

/** Upload video for a segment */
export async function uploadSegmentVideo(
  segmentId: string,
  videoBlob: Blob
): Promise<ApiResponse<{ url: string }>> {
  const url = `${API_URL}/api/upload/video/segment/${segmentId}`;
  const formData = new FormData();
  formData.append("file", videoBlob, "recording.webm");

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message:
            errorBody?.detail ??
            errorBody?.message ??
            `Upload failed with status ${response.status}`,
        },
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message:
          err instanceof Error ? err.message : "Upload failed unexpectedly",
      },
    };
  }
}

/** Reorder a segment to a new position */
export async function reorderSegment(
  scrimId: string,
  segmentId: string,
  newOrder: number
): Promise<ApiResponse<ScrimSegment>> {
  return apiFetch<ScrimSegment>(
    `/api/scrims/${scrimId}/segments/${segmentId}/reorder?new_order=${newOrder}`,
    { method: "PUT" }
  );
}

/** Get the URL for a segment's video */
export function getSegmentVideoUrl(segmentId: string): string {
  return `${API_URL}/api/upload/video/segment/${segmentId}`;
}
