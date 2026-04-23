import type { Scrim, ApiResponse, PaginatedResponse, FileMap } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Data required to create a new scrim */
export interface ScrimCreate {
  title: string;
  description?: string;
  language: string;
  initialFiles: FileMap;
  tags?: string[];
}

/** Data for updating an existing scrim */
export interface ScrimUpdate {
  title?: string;
  description?: string;
  status?: Scrim["status"];
  events?: Scrim["events"];
  durationMs?: number;
  tags?: string[];
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

/** Fetch all scrims with optional pagination */
export async function fetchScrims(
  page = 1,
  pageSize = 20
): Promise<ApiResponse<PaginatedResponse<Scrim>>> {
  return apiFetch<PaginatedResponse<Scrim>>(
    `/api/scrims?page=${page}&pageSize=${pageSize}`
  );
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
    method: "PATCH",
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
  const url = `${API_URL}/api/scrims/${scrimId}/video`;
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
  return `${API_URL}/api/scrims/${scrimId}/video`;
}
