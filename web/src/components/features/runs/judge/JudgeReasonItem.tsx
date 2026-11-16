import { type SeeLink, SeeLinks } from '@/components/shared/SeeLinks';
import {
  MISSING_FILE,
  MISSING_STEP,
  useCitationTargets,
} from '@/lib/citation-targets';
import {
  type Citation,
  formatHunk,
  formatStep,
  type JudgeReason,
} from '@/lib/judge';

const keyOf = (citation: Citation): string =>
  citation.kind === 'step'
    ? `step-${citation.step?.index}`
    : `hunk-${citation.hunk?.id}`;

type JudgeReasonItemProps = {
  reason: JudgeReason;
};

export function JudgeReasonItem({ reason }: JudgeReasonItemProps) {
  const targets = useCitationTargets();

  const linkOf = (citation: Citation): SeeLink => {
    const key = keyOf(citation);

    if (citation.hunk) {
      const reveal = citation.hunk.path ? targets.hunk(citation.hunk) : null;
      const label = formatHunk(citation.hunk);
      const title = citation.hunk.path ?? undefined;

      return reveal
        ? { key, label, title, onClick: reveal }
        : { key, label, title, unavailable: MISSING_FILE };
    }

    const reveal =
      citation.step && citation.step.text !== null
        ? targets.step(citation.step.index)
        : null;
    const label = formatStep(citation);

    return reveal
      ? { key, label, onClick: reveal }
      : { key, label, unavailable: MISSING_STEP };
  };

  return (
    <li data-slot="judge-reason" className="flex flex-col gap-0.5">
      <p className="text-muted-foreground text-sm leading-5">{reason.text}</p>
      <SeeLinks links={reason.citations.map(linkOf)} />
    </li>
  );
}
