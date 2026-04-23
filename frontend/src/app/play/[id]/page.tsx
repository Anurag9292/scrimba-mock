import Link from "next/link";

interface PlayerPageProps {
  params: { id: string };
}

export default function PlayerPage({ params }: PlayerPageProps) {
  const { id } = params;

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-gray-800 bg-gray-900/50 px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </Link>
          <div className="h-5 w-px bg-gray-800" />
          <h1 className="text-sm font-semibold text-white">
            Player
          </h1>
          <span className="rounded-md bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-500">
            {id}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-secondary py-1.5 text-xs"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M13.75 7h-3v5.296l1.943-2.048a.75.75 0 011.114 1.004l-3.25 3.5a.75.75 0 01-1.114 0l-3.25-3.5a.75.75 0 111.114-1.004l1.943 2.048V7h1.5V1.75a.75.75 0 00-1.5 0V7h-3A2.25 2.25 0 004 9.25v7.5A2.25 2.25 0 006.25 19h7.5A2.25 2.25 0 0016 16.75v-7.5A2.25 2.25 0 0013.75 7z" />
            </svg>
            Fork
          </button>
        </div>
      </header>

      {/* Split layout: editor + video */}
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Editor panel */}
        <div className="flex flex-1 flex-col border-r border-gray-800">
          {/* Tab bar */}
          <div className="flex h-10 items-center border-b border-gray-800 bg-gray-900/20">
            <div className="flex h-full items-center border-r border-gray-800 bg-gray-900/40 px-4 text-sm text-white">
              index.tsx
            </div>
          </div>

          {/* Editor placeholder */}
          <div className="flex flex-1 items-center justify-center bg-gray-950">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
                <svg
                  className="h-8 w-8 text-gray-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-500">
                Interactive editor loads here
              </p>
              <p className="mt-1 text-xs text-gray-600">
                Pause playback to edit the code yourself
              </p>
            </div>
          </div>
        </div>

        {/* Video / audio panel */}
        <div className="flex w-80 shrink-0 flex-col bg-gray-900/30">
          {/* Video area */}
          <div className="flex aspect-video items-center justify-center border-b border-gray-800 bg-black">
            <div className="text-center">
              <svg
                className="mx-auto h-10 w-10 text-gray-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
              <p className="mt-2 text-xs text-gray-600">Video preview</p>
            </div>
          </div>

          {/* Playback controls */}
          <div className="border-b border-gray-800 p-4">
            {/* Progress bar */}
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-gray-800">
              <div className="h-full w-1/3 rounded-full bg-brand-500" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                  aria-label="Play"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </button>
                <span className="font-mono text-xs text-gray-500">
                  0:00 / 0:00
                </span>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                aria-label="Settings"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrim info */}
          <div className="flex-1 p-4">
            <h2 className="text-sm font-semibold text-white">
              Scrim: {id}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              This is the interactive player view. When the scrim is loaded,
              you can watch the recorded coding session and pause at any point
              to edit the code in the editor panel.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Interactive code editing
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Pause and resume playback
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Fork to create your own version
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
