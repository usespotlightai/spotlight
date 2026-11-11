import { useMessagesInFlight } from '@/hooks/api/useSendMessage';
import { useLatestRun } from '@/hooks/useLatestRun';
import { useMe } from '@/hooks/useMe';
import type { TeamRun } from '@/lib/run';
import {
  type LatestRun,
  type RunNotes,
  threadProgress,
  withMessagesInFlight,
} from '@/lib/run-notes';

type RunThread<Latest> = {
  latest: Latest;
  conversation: RunNotes | undefined;
  progress: ReturnType<typeof threadProgress>;
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
) {
  const latest = useLatestRun(run, reported);
  const inFlight = useMessagesInFlight([run?.id ?? '', latest?.id ?? '']);
  const me = useMe();

  const conversation = reported && withMessagesInFlight(reported, inFlight, me);

  return {
    latest,
    conversation,
    progress: threadProgress(latest, conversation),
  };
}
