import { useState } from 'react';
import { CitationChip } from '@/components/features/runs/judge/CitationChip';
import { CitedHunk } from '@/components/features/runs/judge/CitedHunk';
import { CitedStep } from '@/components/features/runs/judge/CitedStep';
import { type FileChange, linesOfHunk } from '@/lib/changes';
import { useChangesPanel } from '@/lib/changes-panel';
import {
  type Citation,
  fileOfHunk,
  hunkShown,
  type JudgeReason,
  stepShown,
} from '@/lib/judge';
import { useStepAnchors } from '@/lib/step-anchors';

const keyOf = (citation: Citation): string =>
  citation.kind === 'step'
    ? `step-${citation.step?.index}`
    : `hunk-${citation.hunk?.id}`;

type JudgeReasonItemProps = {
  reason: JudgeReason;
  files: readonly FileChange[];
};

export function JudgeReasonItem({ reason, files }: JudgeReasonItemProps) {
  const [unfolded, setUnfolded] = useState<string | null>(null);
  const { open } = useChangesPanel();
  const anchors = useStepAnchors();
  const shown = reason.citations.find((each) => keyOf(each) === unfolded);

  const follow = (citation: Citation) => {
    const file = citation.hunk ? fileOfHunk(citation.hunk, files) : null;
    const step = citation.step?.index;

    if (file && citation.hunk) {
      open(file, linesOfHunk(citation.hunk.header) ?? undefined);
      return;
    }
    if (step !== undefined && anchors.holds(step)) {
      setUnfolded(null);
      anchors.focus(step);
      return;
    }

    const key = keyOf(citation);
    setUnfolded((was) => (was === key ? null : key));
  };

  return (
    <li data-slot="judge-reason" className="flex flex-col gap-1">
      <p className="text-foreground text-sm leading-6">{reason.text}</p>

      <ul aria-label="Cites" className="flex flex-wrap gap-1">
        {reason.citations.map((citation) => (
          <li key={keyOf(citation)}>
            <CitationChip
              kind={citation.kind}
              pressed={keyOf(citation) === unfolded}
              onClick={() => follow(citation)}
            >
              {citation.hunk ? hunkShown(citation.hunk) : stepShown(citation)}
            </CitationChip>
          </li>
        ))}
      </ul>

      {shown?.step && <CitedStep step={shown.step} />}
      {shown?.hunk && <CitedHunk hunk={shown.hunk} />}
    </li>
  );
}
