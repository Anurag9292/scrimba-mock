import type { Scrim, ApiResponse } from "./types";

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

/** Fetch all scrims */
export async function fetchScrims(): Promise<ApiResponse<Scrim[]>> {
  return apiFetch<Scrim[]>("/api/scrims");
}

/** Fetch a single scrim by ID */
export async function fetchScrim(id: string): Promise<ApiResponse<Scrim>> {
  return apiFetch<Scrim>(`/api/scrims/${id}`);
}

/** Create a new scrim */
export async function createScrim(
  data: ScrimCreate
): Promise<ApiResponse<Scrim>> {
  return apiFetch<Scrim>("/api/scrims", {
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
