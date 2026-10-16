import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { inboxKeys } from '@/hooks/api/useInbox';
import { lineKeys } from '@/hooks/api/useLines';
import { provisioningQuery } from '@/hooks/api/useOnboarding';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type { WorkspaceResponseDto } from '@/lib/api';
import { forgetOpenedHere, wasOpenedHere } from '@/lib/provisioning';

const NO_TEAMS: WorkspaceResponseDto['teams'] = [];

export function useSettingUp(
  slug: string | undefined,
  workspace: WorkspaceResponseDto | null | undefined,
): boolean {
  const queryClient = useQueryClient();
  const teams = workspace?.teams ?? NO_TEAMS;
  const openingTeam = workspace?.provisioning === 'pending';
  const [waitingFor, setWaitingFor] = useState(
    wasOpenedHere(slug) ? slug : undefined,
  );
  const waiting = openingTeam || waitingFor === slug;
  const onboardings = useQueries({
    queries: teams.map((team) => ({
      ...provisioningQuery(team.id),
      enabled: waiting,
    })),
  });
  const settingUp =
    openingTeam ||
    (waiting &&
      onboardings.some(
        (each) => each.data?.provisioning === 'pending' || each.isPending,
      ));
  const wasSettingUp = useRef(settingUp);

  useEffect(() => {
    if (openingTeam) {
      setWaitingFor(slug);
    }
  }, [openingTeam, slug]);

  useEffect(() => {
    if (wasSettingUp.current && !settingUp) {
      setWaitingFor(undefined);
      forgetOpenedHere(slug);
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
