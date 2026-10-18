import { useState } from 'react';
import { FileDiffSkeleton } from '@/components/features/changes/FileDiffSkeleton';
import { LargeDiffNotice } from '@/components/features/changes/LargeDiffNotice';
import { HunkReview } from '@/components/features/review/HunkReview';
import { useAfterPaint } from '@/hooks/useAfterPaint';
import { isLargeDiff, type LayerFile, linesOf } from '@/lib/change-stack';

type LayerFileDiffProps = {
  file: LayerFile['file'];
  hunks: LayerFile['hunks'];
  mounted: boolean;
  lines: number;
};

export function LayerFileDiff({
  file,
  hunks,
  mounted,
  lines,
}: LayerFileDiffProps) {
  const [loaded, setLoaded] = useState(false);

  if (loaded && !mounted) {
    setLoaded(false);
  }

  const collapsed = mounted && isLargeDiff(hunks) && !loaded;
  const drawn = useAfterPaint(mounted && !collapsed);

  if (collapsed) {
    return <LargeDiffNotice lines={lines} onLoad={() => setLoaded(true)} />;
  }

  if (!drawn) {
    return mounted ? <FileDiffSkeleton lines={linesOf(hunks)} /> : null;
  }

  return (
    <ol className="flex flex-col divide-y-[0.5px] divide-border">
      {hunks.map((hunk) => (
        <li key={hunk.id} className="flex flex-col">
          {hunk.patch ? (
            <HunkReview file={file} hunk={hunk} />
          ) : (
            <p className="px-3 py-2 text-faint text-xs">
              {file.binary
                ? 'This file is binary. It has no lines to show.'
                : 'No lines changed.'}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
