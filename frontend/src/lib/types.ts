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

/** Audio track metadata */
export interface AudioTrack {
  /** URL to the audio file (could be a blob URL or remote URL) */
  url: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** MIME type of the audio (e.g., "audio/webm") */
  mimeType: string;
}

/** Status of a scrim */
export type ScrimStatus = "draft" | "recording" | "processing" | "published" | "archived";

/** A complete scrim (recorded interactive coding session) */
export interface Scrim {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Optional description */
  description?: string;
  /** Author user ID */
  authorId: string;
  /** Author display name */
  authorName: string;
  /** Current status */
  status: ScrimStatus;
  /** Programming language of the primary file */
  language: Language;
  /** Initial file state when the recording starts */
  initialFiles: FileMap;
  /** Ordered list of code events making up the recording */
  events: CodeEvent[];
  /** Audio narration track */
  audio?: AudioTrack;
  /** Total duration in milliseconds */
  durationMs: number;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last-updated timestamp */
  updatedAt: string;
  /** Tags for categorization */
  tags?: string[];
  /** Thumbnail image URL */
  thumbnailUrl?: string;
  /** Number of views */
  viewCount: number;
  /** Number of forks */
  forkCount: number;
  /** ID of the scrim this was forked from, if any */
  forkedFromId?: string;
}

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
