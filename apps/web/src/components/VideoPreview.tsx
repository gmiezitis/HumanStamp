'use client';

import { useState } from 'react';

export function VideoPreview({
  src,
  filename,
}: {
  src: string;
  filename: string;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <section aria-label="Video preview" className="space-y-3">
      <video
        key={`${src}-${attempt}`}
        src={src}
        controls
        playsInline
        preload="metadata"
        aria-label={`Preview ${filename}`}
        onError={() => setFailed(true)}
        className="w-full aspect-video bg-stone-950 rounded-xl"
      />
      {failed ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <p>
            Preview could not be played. The file may be unavailable or use an
            unsupported codec. Ask the agency for a playable MP4 before
            approving.
          </p>
          <button
            type="button"
            className="underline mt-2"
            onClick={() => {
              setFailed(false);
              setAttempt(attempt + 1);
            }}
          >
            Retry preview
          </button>
        </div>
      ) : (
        <p className="text-xs text-stone-500">
          Watch this exact version before deciding. Playback support depends on
          the video codec and your browser.
        </p>
      )}
    </section>
  );
}
