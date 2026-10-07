import { useState } from 'react';
import { FileThread } from '@/components/features/changes/FileThread';
import { LayerFileDiff } from '@/components/features/changes/LayerFileDiff';
import { LayerFileHeader } from '@/components/features/changes/LayerFileHeader';
import { FileDecisions } from '@/components/features/decisions/FileDecisions';
import { UNFOLD_MS, Unfold } from '@/components/shared/Unfold';
import { useLingering } from '@/hooks/useLingering';
import { type LayerFile, tallyOf } from '@/lib/change-stack';
import { useReviewing } from '@/lib/review-context';

type LayerFileCardProps = {
  placed: LayerFile;
  open: boolean;
  onToggle: () => void;
};

export function LayerFileCard({ placed, open, onToggle }: LayerFileCardProps) {
  const { file, hunks, note } = placed;
  const tally = tallyOf(hunks);
  const [replying, setReplying] = useState(false);
  const reviewing = useReviewing();
  const mounted = useLingering(open || null, UNFOLD_MS) !== null;

  const comment = () => {
    if (!open) {
      onToggle();
    }
    setReplying(true);
  };

  return (
    <article
      aria-label={file.path}
      className="overflow-hidden rounded-lg border-[0.5px] border-border bg-card"
    >
      <LayerFileHeader
        file={file}
        tally={tally}
        open={open}
        onToggle={onToggle}
        onComment={reviewing ? comment : undefined}
      />

      <Unfold open={open} appear={false}>
        <FileThread
          path={file.path}
          note={note}
          replying={replying}
          onReplying={setReplying}
        />

        <FileDecisions path={file.path} />

        <LayerFileDiff
          file={file}
          hunks={hunks}
          mounted={mounted}
          lines={tally.added + tally.removed}
        />
      </Unfold>
    </article>
  );
}
