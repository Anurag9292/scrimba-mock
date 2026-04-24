import type { Lesson, LessonSegment, Checkpoint, SlideContent, ApiResponse, User, TokenResponse, CoursePath, Course, Section } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Token management ---
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
  if (token) {
    localStorage.setItem("auth_token", token);
  } else {
    localStorage.removeItem("auth_token");
  }
}

export function getAuthToken(): string | null {
  if (_authToken) return _authToken;
  if (typeof window !== "undefined") {
    _authToken = localStorage.getItem("auth_token");
  }
  return _authToken;
}

/** Data required to create a new lesson */
export interface LessonCreate {
  title: string;
  description?: string;
  language?: string;
  initial_code?: string;
  code_events?: Array<Record<string, unknown>>;
  files?: Record<string, string>;
  duration_ms?: number;
  status?: "draft" | "published";
  section_id?: string;
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

/** Data for updating an existing lesson */
export interface LessonUpdate {
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
  
  const token = getAuthToken();
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      let errorMessage: string;
      if (typeof errorBody?.detail === "string") {
        errorMessage = errorBody.detail;
      } else if (Array.isArray(errorBody?.detail)) {
        // Pydantic validation errors are arrays of {type, loc, msg, input}
        errorMessage = errorBody.detail
          .map((e: { msg?: string; loc?: unknown[] }) =>
            e.msg ? `${e.msg}${e.loc ? ` (${e.loc.join(" → ")})` : ""}` : JSON.stringify(e)
          )
          .join("; ");
      } else if (typeof errorBody?.message === "string") {
        errorMessage = errorBody.message;
      } else {
        errorMessage = `Request failed with status ${response.status}`;
      }
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorMessage,
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

/** Fetch all lessons, optionally filtered by status and/or standalone flag */
export async function fetchLessons(
  status?: "draft" | "published",
  options?: { standalone?: boolean }
): Promise<ApiResponse<Lesson[]>> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (options?.standalone) params.set("standalone", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<Lesson[]>(`/api/lessons/${query}`);
}

/** Fetch a single lesson by ID */
export async function fetchLesson(id: string): Promise<ApiResponse<Lesson>> {
  return apiFetch<Lesson>(`/api/lessons/${id}`);
}

/** Create a new lesson */
export async function createLesson(
  data: LessonCreate
): Promise<ApiResponse<Lesson>> {
  return apiFetch<Lesson>("/api/lessons/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update an existing lesson */
export async function updateLesson(
  id: string,
  data: LessonUpdate
): Promise<ApiResponse<Lesson>> {
  return apiFetch<Lesson>(`/api/lessons/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Delete a lesson */
export async function deleteLesson(
  id: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiFetch<{ deleted: boolean }>(`/api/lessons/${id}`, {
    method: "DELETE",
  });
}

/** Upload audio/video for a lesson */
export async function uploadVideo(
  lessonId: string,
  videoBlob: Blob
): Promise<ApiResponse<{ url: string }>> {
  const url = `${API_URL}/api/upload/video/${lessonId}`;
  const formData = new FormData();
  formData.append("file", videoBlob, "recording.webm");

  try {
    const headers: Record<string, string> = {};
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers,
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

/** Get the URL for a lesson's video/audio recording */
export function getVideoUrl(lessonId: string): string {
  return `${API_URL}/api/upload/video/${lessonId}`;
}

/** Publish a draft lesson */
export async function publishLesson(
  lessonId: string
): Promise<ApiResponse<Lesson>> {
  return apiFetch<Lesson>(`/api/lessons/${lessonId}/publish`, {
    method: "PUT",
  });
}

// --- Segment API ---

/** Fetch all segments for a lesson */
export async function fetchSegments(
  lessonId: string
): Promise<ApiResponse<LessonSegment[]>> {
  return apiFetch<LessonSegment[]>(`/api/lessons/${lessonId}/segments/`);
}

/** Create a new segment for a lesson */
export async function createSegment(
  lessonId: string,
  data: SegmentCreate
): Promise<ApiResponse<LessonSegment>> {
  return apiFetch<LessonSegment>(`/api/lessons/${lessonId}/segments/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update an existing segment */
export async function updateSegment(
  lessonId: string,
  segmentId: string,
  data: SegmentUpdate
): Promise<ApiResponse<LessonSegment>> {
  return apiFetch<LessonSegment>(
    `/api/lessons/${lessonId}/segments/${segmentId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

/** Delete a segment */
export async function deleteSegment(
  lessonId: string,
  segmentId: string
): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/lessons/${lessonId}/segments/${segmentId}`, {
    method: "DELETE",
  });
}

/** Reorder a segment to a new position */
export async function reorderSegment(
  lessonId: string,
  segmentId: string,
  newOrder: number
): Promise<ApiResponse<LessonSegment>> {
  return apiFetch<LessonSegment>(
    `/api/lessons/${lessonId}/segments/${segmentId}/reorder?new_order=${newOrder}`,
    { method: "PUT" }
  );
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
    const headers: Record<string, string> = {};
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers,
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

/** Get the URL for a segment's video */
export function getSegmentVideoUrl(segmentId: string): string {
  return `${API_URL}/api/upload/video/segment/${segmentId}`;
}

// --- Checkpoint API ---

/** Data required to create a new checkpoint */
export interface CheckpointCreate {
  order?: number;
  timestamp_ms: number;
  title: string;
  instructions?: string;
  validation_type?: string;
  validation_config?: Record<string, unknown>;
}

/** Data for updating a checkpoint */
export interface CheckpointUpdate {
  order?: number;
  timestamp_ms?: number;
  title?: string;
  instructions?: string;
  validation_type?: string;
  validation_config?: Record<string, unknown>;
}

/** Fetch all checkpoints for a specific segment */
export async function fetchCheckpoints(
  lessonId: string,
  segmentId: string
): Promise<ApiResponse<Checkpoint[]>> {
  return apiFetch<Checkpoint[]>(
    `/api/lessons/${lessonId}/segments/${segmentId}/checkpoints/`
  );
}

/** Fetch all checkpoints across all segments of a lesson (bulk fetch for the player) */
export async function fetchLessonCheckpoints(
  lessonId: string
): Promise<ApiResponse<Checkpoint[]>> {
  return apiFetch<Checkpoint[]>(`/api/lessons/${lessonId}/checkpoints/`);
}

/** Create a new checkpoint for a segment */
export async function createCheckpoint(
  lessonId: string,
  segmentId: string,
  data: CheckpointCreate
): Promise<ApiResponse<Checkpoint>> {
  return apiFetch<Checkpoint>(
    `/api/lessons/${lessonId}/segments/${segmentId}/checkpoints/`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

/** Update an existing checkpoint */
export async function updateCheckpoint(
  lessonId: string,
  segmentId: string,
  checkpointId: string,
  data: CheckpointUpdate
): Promise<ApiResponse<Checkpoint>> {
  return apiFetch<Checkpoint>(
    `/api/lessons/${lessonId}/segments/${segmentId}/checkpoints/${checkpointId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

/** Delete a checkpoint */
export async function deleteCheckpoint(
  lessonId: string,
  segmentId: string,
  checkpointId: string
): Promise<ApiResponse<void>> {
  return apiFetch<void>(
    `/api/lessons/${lessonId}/segments/${segmentId}/checkpoints/${checkpointId}`,
    { method: "DELETE" }
  );
}

/** Reorder a checkpoint to a new position */
export async function reorderCheckpoint(
  lessonId: string,
  segmentId: string,
  checkpointId: string,
  newOrder: number
): Promise<ApiResponse<Checkpoint>> {
  return apiFetch<Checkpoint>(
    `/api/lessons/${lessonId}/segments/${segmentId}/checkpoints/${checkpointId}/reorder?new_order=${newOrder}`,
    { method: "PUT" }
  );
}

// --- Slide API ---

/** Data required to create a new slide */
export interface SlideCreate {
  order?: number;
  type?: string;
  title?: string;
  content?: string;
  language?: string;
  timestamp_ms?: number;
}

/** Data for updating a slide */
export interface SlideUpdate {
  order?: number;
  type?: string;
  title?: string;
  content?: string;
  language?: string;
  timestamp_ms?: number;
}

/** Fetch all slides for a specific segment */
export async function fetchSlides(
  lessonId: string,
  segmentId: string
): Promise<ApiResponse<SlideContent[]>> {
  return apiFetch<SlideContent[]>(
    `/api/lessons/${lessonId}/segments/${segmentId}/slides/`
  );
}

/** Fetch all slides across all segments of a lesson (bulk fetch for the player) */
export async function fetchLessonSlides(
  lessonId: string
): Promise<ApiResponse<SlideContent[]>> {
  return apiFetch<SlideContent[]>(`/api/lessons/${lessonId}/slides/`);
}

/** Create a new slide for a segment */
export async function createSlide(
  lessonId: string,
  segmentId: string,
  data: SlideCreate
): Promise<ApiResponse<SlideContent>> {
  return apiFetch<SlideContent>(
    `/api/lessons/${lessonId}/segments/${segmentId}/slides/`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

/** Update an existing slide */
export async function updateSlide(
  lessonId: string,
  segmentId: string,
  slideId: string,
  data: SlideUpdate
): Promise<ApiResponse<SlideContent>> {
  return apiFetch<SlideContent>(
    `/api/lessons/${lessonId}/segments/${segmentId}/slides/${slideId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

/** Delete a slide */
export async function deleteSlide(
  lessonId: string,
  segmentId: string,
  slideId: string
): Promise<ApiResponse<void>> {
  return apiFetch<void>(
    `/api/lessons/${lessonId}/segments/${segmentId}/slides/${slideId}`,
    { method: "DELETE" }
  );
}

/** Reorder a slide to a new position */
export async function reorderSlide(
  lessonId: string,
  segmentId: string,
  slideId: string,
  newOrder: number
): Promise<ApiResponse<SlideContent>> {
  return apiFetch<SlideContent>(
    `/api/lessons/${lessonId}/segments/${segmentId}/slides/${slideId}/reorder?new_order=${newOrder}`,
    { method: "PUT" }
  );
}

/** Upload an image for a slide */
export async function uploadSlideImage(
  lessonId: string,
  segmentId: string,
  slideId: string,
  imageFile: File
): Promise<ApiResponse<{ filename: string }>> {
  const url = `${API_URL}/api/lessons/${lessonId}/segments/${segmentId}/slides/${slideId}/image`;
  const formData = new FormData();
  formData.append("file", imageFile);

  try {
    const headers: Record<string, string> = {};
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers,
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

/** Get the URL for a slide's image */
export function getSlideImageUrl(
  lessonId: string,
  segmentId: string,
  slideId: string
): string {
  return `${API_URL}/api/lessons/${lessonId}/segments/${segmentId}/slides/${slideId}/image`;
}

// --- Auth API ---

export async function registerUser(data: {
  email: string;
  username: string;
  password: string;
}): Promise<ApiResponse<TokenResponse>> {
  return apiFetch<TokenResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function loginUser(data: {
  email: string;
  password: string;
}): Promise<ApiResponse<TokenResponse>> {
  return apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchMe(): Promise<ApiResponse<User>> {
  return apiFetch<User>("/api/auth/me");
}

export async function updateMe(data: {
  username?: string;
  avatar_url?: string;
}): Promise<ApiResponse<User>> {
  return apiFetch<User>("/api/auth/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getGoogleOAuthUrl(
  redirectUri: string
): Promise<ApiResponse<{ url: string }>> {
  return apiFetch<{ url: string }>(
    `/api/auth/oauth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`
  );
}

export async function googleOAuthCallback(data: {
  code: string;
  redirect_uri: string;
}): Promise<ApiResponse<TokenResponse>> {
  return apiFetch<TokenResponse>("/api/auth/oauth/google", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Admin API ---

export async function fetchUsers(): Promise<ApiResponse<User[]>> {
  return apiFetch<User[]>("/api/admin/users");
}

export async function changeUserRole(
  userId: string,
  role: string
): Promise<ApiResponse<User>> {
  return apiFetch<User>(`/api/admin/users/${userId}/role?role=${role}`, {
    method: "PUT",
  });
}

export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<ApiResponse<User>> {
  return apiFetch<User>(
    `/api/admin/users/${userId}/active?is_active=${isActive}`,
    { method: "PUT" }
  );
}

// --- Course Path API ---

export async function fetchCoursePaths(): Promise<ApiResponse<CoursePath[]>> {
  return apiFetch<CoursePath[]>("/api/paths/");
}

export async function fetchCoursePath(
  id: string
): Promise<ApiResponse<CoursePath>> {
  return apiFetch<CoursePath>(`/api/paths/${id}`);
}

export async function createCoursePath(data: {
  title: string;
  description?: string;
  slug?: string;
  image_url?: string;
  status?: string;
}): Promise<ApiResponse<CoursePath>> {
  return apiFetch<CoursePath>("/api/paths/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCoursePath(
  id: string,
  data: {
    title?: string;
    description?: string;
    slug?: string;
    image_url?: string;
    status?: string;
  }
): Promise<ApiResponse<CoursePath>> {
  return apiFetch<CoursePath>(`/api/paths/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCoursePath(
  id: string
): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/paths/${id}`, { method: "DELETE" });
}

// --- Course API ---

export async function fetchCourses(
  pathId: string
): Promise<ApiResponse<Course[]>> {
  return apiFetch<Course[]>(`/api/paths/${pathId}/courses/`);
}

export async function fetchCourse(
  pathId: string,
  courseId: string
): Promise<ApiResponse<Course>> {
  return apiFetch<Course>(`/api/paths/${pathId}/courses/${courseId}`);
}

export async function createCourse(
  pathId: string,
  data: {
    title: string;
    description?: string;
    slug?: string;
    status?: string;
  }
): Promise<ApiResponse<Course>> {
  return apiFetch<Course>(`/api/paths/${pathId}/courses/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCourse(
  pathId: string,
  courseId: string,
  data: {
    title?: string;
    description?: string;
    slug?: string;
    status?: string;
  }
): Promise<ApiResponse<Course>> {
  return apiFetch<Course>(`/api/paths/${pathId}/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCourse(
  pathId: string,
  courseId: string
): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/paths/${pathId}/courses/${courseId}`, {
    method: "DELETE",
  });
}

// --- Section API ---

export async function fetchSections(
  courseId: string
): Promise<ApiResponse<Section[]>> {
  return apiFetch<Section[]>(`/api/courses/${courseId}/sections/`);
}

export async function fetchSection(
  courseId: string,
  sectionId: string
): Promise<ApiResponse<Section>> {
  return apiFetch<Section>(`/api/courses/${courseId}/sections/${sectionId}`);
}

export async function createSection(
  courseId: string,
  data: {
    title: string;
    description?: string;
    order?: number;
  }
): Promise<ApiResponse<Section>> {
  return apiFetch<Section>(`/api/courses/${courseId}/sections/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSection(
  courseId: string,
  sectionId: string,
  data: {
    title?: string;
    description?: string;
  }
): Promise<ApiResponse<Section>> {
  return apiFetch<Section>(`/api/courses/${courseId}/sections/${sectionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSection(
  courseId: string,
  sectionId: string
): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/courses/${courseId}/sections/${sectionId}`, {
    method: "DELETE",
  });
}

export async function fetchSectionLessons(
  courseId: string,
  sectionId: string
): Promise<ApiResponse<Lesson[]>> {
  return apiFetch<Lesson[]>(
    `/api/courses/${courseId}/sections/${sectionId}/lessons`
  );
}
