import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { changeStackKeys } from '@/hooks/api/useRunChangeStacks';
import { runMemoryKeys } from '@/hooks/api/useRunMemories';
import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { runScoreKeys } from '@/hooks/api/useRunScores';
import { useRunStream } from '@/hooks/api/useRunStream';
import { journalKeys } from '@/hooks/api/useTaskJournal';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { type Progress, type TeamRun, underway } from '@/lib/run';
import type { LatestRun } from '@/lib/run-notes';

type RunRefreshParams = {
  readonly teamId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly state?: TeamRun['state'];
  readonly progress?: Progress | null;
  readonly following?: Pick<LatestRun, 'id' | 'state' | 'progress'>;
};

export function useRunRefresh({
  teamId,
  runId,
  taskId,
  state,
  progress = null,
  following,
}: RunRefreshParams) {
  const watchedId = following?.id ?? runId;
  const watchedState = following?.state ?? state;
  const watchedProgress = following ? following.progress : progress;
  const queryClient = useQueryClient();

  const bump = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: journalKeys.forTask(taskId),
    });
    void queryClient.invalidateQueries({
      queryKey: runNotesKeys.forRun(runId),
    });
    void queryClient.invalidateQueries({
      queryKey: teamRunKeys.forTeam(teamId),
    });
    void queryClient.invalidateQueries({
      queryKey: changeStackKeys.forRun(runId),
    });
    if (teamId && runId) {
      void queryClient.invalidateQueries({
        queryKey: runMemoryKeys.forRun(teamId, runId),
      });
    }
  }, [queryClient, taskId, runId, teamId]);

  useRunStream(
    watchedId,
    watchedState !== undefined && underway({ state: watchedState }),
    watchedProgress,
    bump,
  );

  const previous = useRef({ id: watchedId, state: watchedState });

  useEffect(() => {
    const was = previous.current;

    if (
      was.state &&
      watchedState &&
      (was.state !== watchedState || was.id !== watchedId)
    ) {
      bump();
      if (watchedId === runId) {
        void queryClient.invalidateQueries({
          queryKey: runScoreKeys.forRun(runId),
        });
      }
    }
    previous.current = { id: watchedId, state: watchedState };
  }, [watchedId, watchedState, bump, queryClient, runId]);
}
