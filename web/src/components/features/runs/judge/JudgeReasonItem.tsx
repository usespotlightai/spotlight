import { useState } from 'react';
import { CitationChip } from '@/components/features/runs/judge/CitationChip';
import { CitedHunk } from '@/components/features/runs/judge/CitedHunk';
import { CitedStep } from '@/components/features/runs/judge/CitedStep';
import {
  type Citation,
  formatHunk,
  formatStep,
  type JudgeReason,
} from '@/lib/judge';
import { useStepAnchors } from '@/lib/step-anchors';

const keyOf = (citation: Citation): string =>
  citation.kind === 'step'
    ? `step-${citation.step?.index}`
    : `hunk-${citation.hunk?.id}`;

type JudgeReasonItemProps = {
  reason: JudgeReason;
};

export function JudgeReasonItem({ reason }: JudgeReasonItemProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const anchors = useStepAnchors();
  const shown = reason.citations.find((each) => keyOf(each) === expanded);

  const follow = (citation: Citation) => {
    const step = citation.step?.index;

    if (step !== undefined && anchors.has(step)) {
      setExpanded(null);
      anchors.focus(step);
      return;
    }

    const key = keyOf(citation);
    setExpanded((was) => (was === key ? null : key));
  };

  return (
    <li data-slot="judge-reason" className="flex flex-col gap-1">
      <p className="text-foreground text-sm leading-6">{reason.text}</p>

      <ul aria-label="Cites" className="flex flex-wrap gap-1">
        {reason.citations.map((citation) => (
          <li key={keyOf(citation)}>
            <CitationChip
              kind={citation.kind}
              pressed={keyOf(citation) === expanded}
              onClick={() => follow(citation)}
            >
              {citation.hunk ? formatHunk(citation.hunk) : formatStep(citation)}
            </CitationChip>
          </li>
        ))}
      </ul>

      {shown?.step && <CitedStep step={shown.step} />}
      {shown?.hunk && <CitedHunk hunk={shown.hunk} />}
    </li>
  );
}
