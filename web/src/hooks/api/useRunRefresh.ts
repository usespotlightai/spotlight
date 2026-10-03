import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { changeStackKeys } from '@/hooks/api/useRunChangeStacks';
import { runConversationKeys } from '@/hooks/api/useRunConversation';
import { runMemoryKeys } from '@/hooks/api/useRunMemories';
import { runScoreKeys } from '@/hooks/api/useRunScores';
import { useRunStream } from '@/hooks/api/useRunStream';
import { journalKeys } from '@/hooks/api/useTaskJournal';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import type { TeamRun } from '@/lib/run';

type RunRefreshParams = {
  readonly teamId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly state?: TeamRun['state'];
};

export function useRunRefresh({
  teamId,
  runId,
  taskId,
  state,
}: RunRefreshParams) {
  const queryClient = useQueryClient();

  const bump = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: journalKeys.forTask(taskId),
    });
    void queryClient.invalidateQueries({
      queryKey: runConversationKeys.forRun(runId),
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

  useRunStream(runId, state === 'claimed', bump);

  const stood = useRef(state);

  useEffect(() => {
    if (stood.current && state && stood.current !== state) {
      bump();
      void queryClient.invalidateQueries({
        queryKey: runScoreKeys.forRun(runId),
      });
    }
    stood.current = state;
  }, [state, bump, queryClient, runId]);
}
