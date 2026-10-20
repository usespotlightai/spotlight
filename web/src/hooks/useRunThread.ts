import { useMessagesInFlight } from '@/hooks/api/useSendMessage';
import { useLatestRun } from '@/hooks/useLatestRun';
import { useMe } from '@/hooks/useMe';
import type { TeamRun } from '@/lib/run';
import { type RunNotes, withMessagesInFlight } from '@/lib/run-notes';

export function useRunThread(run: TeamRun, reported: RunNotes | undefined) {
  const latest = useLatestRun(run, reported);
  const inFlight = useMessagesInFlight([run.id, latest.id]);
  const me = useMe();

  return {
    latest,
    conversation: reported && withMessagesInFlight(reported, inFlight, me),
  };
}
