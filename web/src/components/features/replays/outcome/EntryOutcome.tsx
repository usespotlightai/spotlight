import { useMemo, useState } from 'react';
import {
  type Focus,
  OutcomeFocus,
} from '@/components/features/replays/outcome/OutcomeFocus';
import { OutcomePart } from '@/components/features/replays/outcome/OutcomePart';
import { ReplayCheck } from '@/components/features/replays/outcome/ReplayCheck';
import { ReplayReasonItem } from '@/components/features/replays/outcome/ReplayReasonItem';
import { RunChanges } from '@/components/features/runs/RunChanges';
import { useReplayRun } from '@/hooks/api/useReplayRun';
import { useRunChangeStacks } from '@/hooks/api/useRunChangeStacks';
import { changesOf, type FileChange, type LineRange } from '@/lib/changes';
import type { ReplayEntry } from '@/lib/replay';
import { whyTitle } from '@/lib/replay-outcome';
import { RunSidePanelContext } from '@/lib/run-side-panel';
import { StepAnchorsContext } from '@/lib/step-anchors';

type EntryOutcomeProps = {
  teamId: string;
  entry: ReplayEntry;
};

export function EntryOutcome({ teamId, entry }: EntryOutcomeProps) {
  const runId = entry.runId ?? undefined;
  const journals = useReplayRun(teamId, runId).data?.journals;
  const stacks = useRunChangeStacks(teamId, runId).data?.stacks ?? [];
  const [focus, setFocus] = useState<Focus | null>(null);

  const steps = useMemo(
    () =>
      (journals ?? [])
        .filter((each) => each.runId === runId)
        .flatMap((each) => each.steps),
    [journals, runId],
  );
  const files = useMemo(() => changesOf(journals ?? []), [journals]);

  const panel = useMemo(
    () => ({
      selected: focus?.kind === 'file' ? focus.file : null,
      lines: focus?.kind === 'file' ? focus.lines : null,
      remembered: null,
      aside: null,
      open: (file: FileChange, lines?: LineRange) =>
        setFocus({ kind: 'file', file, lines: lines ?? null }),
      openRemembered: () => {},
      close: () => setFocus(null),
    }),
    [focus],
  );

  const anchors = useMemo(
    () => ({
      focused: null,
      anchorOf: () => null,
      has: (index: number) => index < steps.length,
      focus: (index: number) => {
        const step = steps[index];
        if (step) {
          setFocus({ kind: 'step', index, step });
        }
      },
    }),
    [steps],
  );

  if (focus) {
    return <OutcomeFocus focus={focus} onBack={() => setFocus(null)} />;
  }

  const why = whyTitle(entry.result);
  const checks = stacks.flatMap((stack) => (stack.check ? [stack.check] : []));

  return (
    <RunSidePanelContext value={panel}>
      <StepAnchorsContext value={anchors}>
        <div data-slot="entry-outcome" className="flex flex-col gap-5">
          {why && entry.reasons.length > 0 && (
            <OutcomePart title={why}>
              <ol className="flex flex-col gap-2">
                {entry.reasons.map((reason, at) => (
                  <ReplayReasonItem
                    // biome-ignore lint/suspicious/noArrayIndexKey: the reasons of an entry are set one time and their order does not change
                    key={at}
                    reason={reason}
                    stacks={stacks}
                    files={files}
                  />
                ))}
              </ol>
            </OutcomePart>
          )}

          {checks.length > 0 && (
            <OutcomePart title="Checks">
              {checks.map((check, at) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: there is one check for each stack, in the order of the stacks
                <ReplayCheck key={at} check={check} />
              ))}
            </OutcomePart>
          )}

          {files.length > 0 && journals && (
            <OutcomePart title="What it changed">
              <RunChanges journals={journals} />
            </OutcomePart>
          )}
        </div>
      </StepAnchorsContext>
    </RunSidePanelContext>
  );
}
