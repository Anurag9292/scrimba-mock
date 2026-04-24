"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type { FileMap } from "@/lib/types";

// ─── Tree node types ───────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string; // Full path like "src/utils/helper.py"
  type: "file" | "folder";
  children?: TreeNode[];
}

// ─── Props ─────────────────────────────────────────────────────

interface FileExplorerProps {
  /** All files (flat map with path keys like "src/main.py") */
  files: FileMap;
  /** Currently active/open file path */
  activeFile?: string;
  /** Called when a file is clicked to open it */
  onFileSelect: (filePath: string) => void;
  /** Called when a new file is created */
  onFileCreate?: (filePath: string) => void;
  /** Called when a file is deleted */
  onFileDelete?: (filePath: string) => void;
  /** Called when a file is renamed */
  onFileRename?: (oldPath: string, newPath: string) => void;
  /** Called when files are uploaded (bulk) */
  onFilesUpload?: (newFiles: FileMap) => void;
  /** Whether to show the upload button */
  showUpload?: boolean;
  /** Whether editing (create/delete/rename) is allowed */
  readOnly?: boolean;
}

// ─── Utilities ─────────────────────────────────────────────────

/** Build a tree structure from flat file paths */
function buildTree(files: FileMap): TreeNode[] {
  const root: TreeNode[] = [];
  const paths = Object.keys(files).sort();

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let existing = currentLevel.find((n) => n.name === part && n.type === (isFile ? "file" : "folder"));

      if (!existing) {
        const node: TreeNode = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };
        currentLevel.push(node);
        existing = node;
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  // Sort: folders first, then files, alphabetically
  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children) sortNodes(n.children);
    }
  }
  sortNodes(root);
  return root;
}

/** Get file extension icon color */
function getIconColor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py": return "bg-emerald-400";
    case "js": case "jsx": return "bg-yellow-400";
    case "ts": case "tsx": return "bg-blue-500";
    case "html": return "bg-orange-400";
    case "css": case "scss": return "bg-blue-400";
    case "json": return "bg-green-400";
    case "md": return "bg-gray-400";
    case "rs": return "bg-orange-500";
    case "go": return "bg-cyan-400";
    default: return "bg-gray-500";
  }
}

// ─── Tree node component ───────────────────────────────────────

function TreeNodeItem({
  node,
  depth,
  activeFile,
  expandedFolders,
  onToggleFolder,
  onFileSelect,
  onDelete,
  readOnly,
}: {
  node: TreeNode;
  depth: number;
  activeFile?: string;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileSelect: (path: string) => void;
  onDelete?: (path: string) => void;
  readOnly?: boolean;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isActive = node.type === "file" && node.path === activeFile;
  const paddingLeft = 12 + depth * 16;

  if (node.type === "folder") {
    return (
      <>
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          className="group flex w-full items-center gap-1.5 py-[3px] text-left text-[12px] text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 transition-colors"
          style={{ paddingLeft }}
        >
          {/* Chevron */}
          <svg
            className={`h-3 w-3 shrink-0 text-gray-600 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
          {/* Folder icon */}
          <svg className="h-3.5 w-3.5 shrink-0 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            {isExpanded ? (
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H2V6z" />
            ) : (
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            )}
          </svg>
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFile={activeFile}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onFileSelect={onFileSelect}
                onDelete={onDelete}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  // File node
  return (
    <button
      type="button"
      onClick={() => onFileSelect(node.path)}
      className={`group flex w-full items-center gap-1.5 py-[3px] text-left text-[12px] transition-colors ${
        isActive
          ? "bg-gray-700/50 text-white"
          : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
      }`}
      style={{ paddingLeft: paddingLeft + 16 }}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${getIconColor(node.name)}`} />
      <span className="truncate flex-1">{node.name}</span>
      {!readOnly && onDelete && (
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.path);
          }}
          className="mr-2 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-gray-600 group-hover:opacity-100"
          title="Delete"
        >
          <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </span>
      )}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────

export default function FileExplorer({
  files,
  activeFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  onFilesUpload,
  showUpload = false,
  readOnly = false,
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const newItemRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const folderUploadRef = useRef<HTMLInputElement>(null);

  const tree = useMemo(() => buildTree(files), [files]);

  // Auto-expand folders that contain the active file
  useMemo(() => {
    if (!activeFile) return;
    const parts = activeFile.split("/");
    const newExpanded = new Set(expandedFolders);
    for (let i = 1; i < parts.length; i++) {
      newExpanded.add(parts.slice(0, i).join("/"));
    }
    if (newExpanded.size !== expandedFolders.size) {
      setExpandedFolders(newExpanded);
    }
  }, [activeFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleCreateFile = useCallback(() => {
    const name = newItemName.trim();
    if (!name) {
      setIsCreatingFile(false);
      setNewItemName("");
      return;
    }
    onFileCreate?.(name);
    setIsCreatingFile(false);
    setNewItemName("");
    // Auto-expand parent folder
    const parts = name.split("/");
    if (parts.length > 1) {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        for (let i = 1; i < parts.length; i++) {
          next.add(parts.slice(0, i).join("/"));
        }
        return next;
      });
    }
    onFileSelect(name);
  }, [newItemName, onFileCreate, onFileSelect]);

  const handleCreateFolder = useCallback(() => {
    const name = newItemName.trim();
    if (!name) {
      setIsCreatingFolder(false);
      setNewItemName("");
      return;
    }
    // Create a placeholder file in the folder so it shows up
    const placeholderPath = name.endsWith("/") ? `${name}.gitkeep` : `${name}/.gitkeep`;
    onFileCreate?.(placeholderPath);
    setIsCreatingFolder(false);
    setNewItemName("");
    // Auto-expand the new folder
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.add(name.replace(/\/$/, ""));
      return next;
    });
  }, [newItemName, onFileCreate]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      const newFiles: FileMap = {};
      const readPromises: Promise<void>[] = [];

      // Skip binary/non-text files
      const textExtensions = new Set([
        "py", "js", "ts", "tsx", "jsx", "html", "css", "scss", "json", "md",
        "txt", "yml", "yaml", "toml", "cfg", "ini", "env", "sh", "bash",
        "rs", "go", "java", "c", "cpp", "h", "hpp", "rb", "php", "sql",
        "xml", "svg", "gitignore", "gitkeep", "dockerfile", "makefile",
      ]);

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        // Skip directories, hidden files, and binary files
        if (file.size === 0 && file.type === "") continue;
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const nameLC = file.name.toLowerCase();
        if (!textExtensions.has(ext) && !textExtensions.has(nameLC)) continue;

        // Use webkitRelativePath for folder uploads, or just the name
        const relativePath = file.webkitRelativePath || file.name;
        readPromises.push(
          new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") {
                newFiles[relativePath] = reader.result;
              }
              resolve();
            };
            reader.onerror = () => resolve();
            reader.readAsText(file);
          })
        );
      }

      await Promise.all(readPromises);
      if (Object.keys(newFiles).length > 0) {
        onFilesUpload?.(newFiles);
      }
      e.target.value = "";
    },
    [onFilesUpload]
  );

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e] border-r border-gray-800">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-gray-800 bg-[#252526] px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Files
        </span>
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            {/* New File */}
            <button
              type="button"
              onClick={() => {
                setIsCreatingFile(true);
                setIsCreatingFolder(false);
                setNewItemName("");
                setTimeout(() => newItemRef.current?.focus(), 50);
              }}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-300"
              title="New File"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 01.439 1.061V16.5A1.5 1.5 0 0113.5 18h-9A1.5 1.5 0 013 16.5v-13zm10 0V6h2.5L13 3.5zM9.25 8.75a.75.75 0 011.5 0v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5z" />
              </svg>
            </button>
            {/* New Folder */}
            <button
              type="button"
              onClick={() => {
                setIsCreatingFolder(true);
                setIsCreatingFile(false);
                setNewItemName("");
                setTimeout(() => newItemRef.current?.focus(), 50);
              }}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-300"
              title="New Folder"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                <path d="M9.25 9.75a.75.75 0 011.5 0v1h1a.75.75 0 010 1.5h-1v1a.75.75 0 01-1.5 0v-1h-1a.75.75 0 010-1.5h1v-1z" fill="rgba(0,0,0,0.3)" />
              </svg>
            </button>
            {/* Upload files */}
            {showUpload && (
              <>
                <button
                  type="button"
                  onClick={() => uploadRef.current?.click()}
                  className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-300"
                  title="Upload Files"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                  </svg>
                </button>
                {/* Upload folder */}
                <button
                  type="button"
                  onClick={() => folderUploadRef.current?.click()}
                  className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-300"
                  title="Upload Folder"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                </button>
                <input
                  ref={uploadRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                />
                <input
                  ref={folderUploadRef}
                  type="file"
                  className="hidden"
                  onChange={handleUpload}
                  {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* New item input */}
      {(isCreatingFile || isCreatingFolder) && (
        <div className="flex items-center gap-1.5 border-b border-gray-800 bg-gray-900/50 px-3 py-1.5">
          {isCreatingFolder ? (
            <svg className="h-3 w-3 shrink-0 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          ) : (
            <span className="h-2 w-2 shrink-0 rounded-full bg-gray-500" />
          )}
          <input
            ref={newItemRef}
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onBlur={() => isCreatingFile ? handleCreateFile() : handleCreateFolder()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                isCreatingFile ? handleCreateFile() : handleCreateFolder();
              }
              if (e.key === "Escape") {
                setIsCreatingFile(false);
                setIsCreatingFolder(false);
                setNewItemName("");
              }
            }}
            placeholder={isCreatingFolder ? "folder-name" : "filename.ext (e.g. src/main.py)"}
            className="flex-1 min-w-0 rounded border border-brand-500/50 bg-gray-800 px-1.5 py-0.5 text-[11px] text-white placeholder-gray-600 outline-none"
          />
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-gray-600">
            No files yet
          </div>
        ) : (
          tree.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={0}
              activeFile={activeFile}
              expandedFolders={expandedFolders}
              onToggleFolder={toggleFolder}
              onFileSelect={onFileSelect}
              onDelete={readOnly ? undefined : onFileDelete}
              readOnly={readOnly}
            />
          ))
        )}
      </div>
    </div>
  );
}
