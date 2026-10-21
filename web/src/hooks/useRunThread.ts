import { useMessagesInFlight } from '@/hooks/api/useSendMessage';
import { useLatestRun } from '@/hooks/useLatestRun';
import { useMe } from '@/hooks/useMe';
import type { ReportedActivity, TeamRun } from '@/lib/run';
import {
  type LatestRun,
  type RunNotes,
  withMessagesInFlight,
} from '@/lib/run-notes';

type RunThread<Latest> = {
  readonly latest: Latest;
  readonly shown: ReportedActivity | null;
  readonly conversation: RunNotes | undefined;
};

export function useRunThread(
  run: TeamRun,
  reported: RunNotes | undefined,
): RunThread<LatestRun>;
export function useRunThread(
  run: TeamRun | undefined,
  reported: RunNotes | undefined,
): RunThread<LatestRun | null>;
export function useRunThread(
  run: TeamRun | undefined,
  reported: RunNotes | undefined,
): RunThread<LatestRun | null> {
  const latest = useLatestRun(run, reported);
  const inFlight = useMessagesInFlight(
    [run?.id, latest?.id].filter((id): id is string => id !== undefined),
  );
  const me = useMe();
  const conversation = reported && withMessagesInFlight(reported, inFlight, me);
  return {
    latest,
    shown: latest?.activity ?? conversation?.latestRun.activity ?? null,
    conversation,
  };
}
