import { CitationChip } from '@/components/features/runs/judge/CitationChip';
import type { ChangeStack } from '@/lib/change-stack';
import type { FileChange } from '@/lib/changes';
import type { ReplayEntry } from '@/lib/replay';
import { fileAt, hunkIn, hunkShown } from '@/lib/replay-outcome';
import { reasonShown } from '@/lib/replay-words';
import { useRunSidePanel } from '@/lib/run-side-panel';
import { useStepAnchors } from '@/lib/step-anchors';

type ReplayReasonItemProps = {
  reason: ReplayEntry['reasons'][number];
  stacks: readonly ChangeStack[];
  files: readonly FileChange[];
};

export function ReplayReasonItem({
  reason,
  stacks,
  files,
}: ReplayReasonItemProps) {
  const panel = useRunSidePanel();
  const anchors = useStepAnchors();
  const hunks = reason.hunks.flatMap((id) => {
    const hunk = hunkIn(stacks, id);
    const file = hunk && fileAt(files, hunk.path);
    return hunk && file ? [{ hunk, file }] : [];
  });
  const steps = reason.steps.filter((index) => anchors.holds(index));

  return (
    <li data-slot="replay-reason" className="flex flex-col gap-1">
      <p className="text-foreground text-sm leading-6">{reasonShown(reason)}</p>

      {(steps.length > 0 || hunks.length > 0) && (
        <ul aria-label="Cites" className="flex flex-wrap gap-1">
          {steps.map((index) => (
            <li key={`step-${index}`}>
              <CitationChip
                kind="step"
                pressed={false}
                onClick={() => anchors.focus(index)}
              >
                Step {index}
              </CitationChip>
            </li>
          ))}
          {hunks.map(({ hunk, file }) => (
            <li key={`hunk-${hunk.id}`}>
              <CitationChip
                kind="hunk"
                pressed={panel.selected === file}
                onClick={() => panel.open(file, hunk.lines)}
              >
                {hunkShown(hunk)}
              </CitationChip>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
