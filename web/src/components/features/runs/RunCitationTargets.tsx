import { type ReactElement, type ReactNode, useMemo } from 'react';

import { changesOf, repoRelative } from '@/lib/changes';
import { CitationTargetsContext } from '@/lib/citation-targets';
import type { RunJournal } from '@/lib/inbox';
import { type CitedHunk, lineRangeOf } from '@/lib/judge';
import { useRunSidePanel } from '@/lib/run-side-panel';
import { useStepAnchors } from '@/lib/step-anchors';

type RunCitationTargetsProps = {
  runId: string;
  journals: readonly RunJournal[];
  children: ReactNode;
};

export function RunCitationTargets({
  runId,
  journals,
  children,
}: RunCitationTargetsProps): ReactElement {
  const anchors = useStepAnchors();
  const { open } = useRunSidePanel();

  const files = useMemo(
    () => changesOf(journals.filter((each) => each.runId === runId)),
    [journals, runId],
  );

  const targets = useMemo(
    () => ({
      step: (index: number) =>
        anchors.has(index) ? () => anchors.focus(index) : null,
      hunk: (hunk: CitedHunk) => {
        const file = files.find(
          (each) => repoRelative(each.path) === hunk.path,
        );

        return file ? () => open(file, lineRangeOf(hunk) ?? undefined) : null;
      },
    }),
    [anchors, files, open],
  );

  return (
    <CitationTargetsContext value={targets}>{children}</CitationTargetsContext>
  );
}
