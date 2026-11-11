import { useMutation, useQueryClient } from '@tanstack/react-query';

import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import {
  setTeamAvatar,
  setWorkspaceAvatar,
  removeTeamAvatar,
  removeWorkspaceAvatar,
} from '@/lib/api';
import { avatarUploadOf } from '@/lib/avatar-image';
import { messageOf } from '@/lib/error';

export type AvatarChange = File | null;

const failure = (change: AvatarChange) =>
  change
    ? 'Sorry, the avatar couldn’t be uploaded.'
    : 'Sorry, the avatar couldn’t be removed.';

function useAvatarChange(
  slug: string | undefined,
  send: (change: AvatarChange) => Promise<{ error?: unknown }>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (change: AvatarChange) => {
      const { error } = await send(change);

      if (error) {
        throw new Error(messageOf(error, failure(change)));
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.all,
          exact: true,
        }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(slug) }),
      ]),
  });
}

export function useWorkspaceAvatar(slug: string | undefined) {
  return useAvatarChange(slug, async (change) => {
    const path = { slug: slug as string };

    return change
      ? setWorkspaceAvatar({ path, body: await avatarUploadOf(change) })
      : removeWorkspaceAvatar({ path });
  });
}

export function useTeamAvatar(
  slug: string | undefined,
  teamId: string | undefined,
) {
  return useAvatarChange(slug, async (change) => {
    const path = { teamId: teamId as string };

    return change
      ? setTeamAvatar({ path, body: await avatarUploadOf(change) })
      : removeTeamAvatar({ path });
  });
}
