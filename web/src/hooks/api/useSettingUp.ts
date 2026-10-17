import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { inboxKeys } from '@/hooks/api/useInbox';
import { lineKeys } from '@/hooks/api/useLines';
import { provisioningQuery } from '@/hooks/api/useOnboarding';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type { WorkspaceResponseDto } from '@/lib/api';
import {
  clearCreatedHere,
  markCreatedHere,
  wasCreatedHere,
} from '@/lib/provisioning';

const NO_TEAMS: WorkspaceResponseDto['teams'] = [];

export function useSettingUp(
  slug: string | undefined,
  workspace: WorkspaceResponseDto | null | undefined,
): boolean {
  const queryClient = useQueryClient();
  const teams = workspace?.teams ?? NO_TEAMS;
  const creatingTeam = workspace?.provisioning === 'pending';
  const waiting = creatingTeam || wasCreatedHere(slug);
  const onboardings = useQueries({
    queries: teams.map((team) => ({
      ...provisioningQuery(team.id),
      enabled: waiting,
    })),
  });
  const settingUp =
    creatingTeam ||
    (waiting &&
      onboardings.some(
        (each) => each.data?.provisioning === 'pending' || each.isPending,
      ));
  const wasSettingUp = useRef(settingUp);

  useEffect(() => {
    if (creatingTeam && slug !== undefined) {
      markCreatedHere(slug);
    }
  }, [creatingTeam, slug]);

  useEffect(() => {
    if (wasSettingUp.current && !settingUp) {
      clearCreatedHere(slug);
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(slug),
      });
      void queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      });

      for (const team of teams) {
        void queryClient.invalidateQueries({
          queryKey: lineKeys.forTeam(team.id),
        });
      }
    }

    wasSettingUp.current = settingUp;
  }, [settingUp, slug, teams, queryClient]);

  return settingUp;
}
