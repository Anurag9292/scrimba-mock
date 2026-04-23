/** A single file's content, keyed by filename */
export type FileMap = Record<string, string>;

/** Supported programming languages for the editor */
export type Language =
  | "typescript"
  | "javascript"
  | "html"
  | "css"
  | "json"
  | "markdown"
  | "python"
  | "rust"
  | "go";

/** Types of events that can be recorded during a scrim session */
export type CodeEventType =
  | "insert"
  | "delete"
  | "replace"
  | "cursor"
  | "selection"
  | "file_create"
  | "file_delete"
  | "file_rename"
  | "file_switch";

/** A single recorded code event with timing information */
export interface CodeEvent {
  /** Event type discriminator */
  type: CodeEventType;
  /** Milliseconds from the start of the recording */
  timestamp: number;
  /** The file this event applies to */
  fileName: string;
  /** Starting position (line, column) for text operations */
  startPosition?: CursorPosition;
  /** Ending position (line, column) for range-based operations */
  endPosition?: CursorPosition;
  /** The text content that was inserted or used as replacement */
  text?: string;
  /** For rename events, the new file name */
  newFileName?: string;
}

/** Cursor position within a file */
export interface CursorPosition {
  /** 1-based line number */
  lineNumber: number;
  /** 1-based column number */
  column: number;
}

/** A selection range in the editor */
export interface SelectionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/** Recording status for the UI */
export type RecordingStatus = "idle" | "recording" | "paused" | "stopped";

/** Scrim status */
export type ScrimStatus = "draft" | "published";

/** A complete scrim (recorded interactive coding session) */
export interface Scrim {
  id: string;
  title: string;
  description?: string;
  duration_ms: number;
  video_filename?: string;
  code_events: CodeEvent[];
  initial_code: string;
  language: string;
  files?: FileMap;
  status: ScrimStatus;
  created_at: string;
  updated_at: string;
}

/** A single segment within a multi-segment scrim recording */
export interface ScrimSegment {
  id: string;
  scrim_id: string;
  order: number;
  video_filename?: string;
  code_events: CodeEvent[];
  initial_files: FileMap;
  duration_ms: number;
  trim_start_ms: number;
  trim_end_ms: number | null;
  created_at: string;
  updated_at: string;
}

/** Supported checkpoint validation types */
export type ValidationType = "output_match";

/** Configuration for checkpoint validation */
export interface ValidationConfig {
  /** Expected output content to match against (for output_match) */
  expected_output?: string;
}

/** A checkpoint/challenge within a segment */
export interface Checkpoint {
  id: string;
  segment_id: string;
  order: number;
  /** Segment-local timestamp in ms (relative to trimmed segment start) */
  timestamp_ms: number;
  title: string;
  instructions: string;
  validation_type: ValidationType;
  validation_config: ValidationConfig;
  created_at: string;
  updated_at: string;
}

/** Status of a checkpoint during playback */
export type CheckpointStatus = "idle" | "active" | "validating" | "passed" | "failed";

/** Playback state for the player */
export interface PlaybackState {
  /** Whether the scrim is currently playing */
  isPlaying: boolean;
  /** Current playback position in milliseconds */
  currentTimeMs: number;
  /** Playback speed multiplier (e.g., 1.0, 1.5, 2.0) */
  playbackRate: number;
  /** Current state of the files at this point in playback */
  currentFiles: FileMap;
  /** The currently active/visible file */
  activeFileName: string;
  /** Whether the user has paused to interactively edit */
  isInteractiveMode: boolean;
}

/** Recording session state */
export interface RecordingState {
  /** Whether recording is in progress */
  isRecording: boolean;
  /** Start time of the recording (Date.now()) */
  startedAt: number | null;
  /** Elapsed recording time in milliseconds */
  elapsedMs: number;
  /** Events captured so far */
  events: CodeEvent[];
  /** Current file contents */
  files: FileMap;
  /** The currently active file being edited */
  activeFileName: string;
}

/** Editor tab representation */
export interface EditorTab {
  /** File name / path */
  fileName: string;
  /** Whether this tab is currently active */
  isActive: boolean;
  /** Whether the file has unsaved modifications */
  isDirty: boolean;
}

/** API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
