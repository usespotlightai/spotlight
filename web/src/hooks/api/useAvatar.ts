import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import {
  setTeamAvatar,
  setWorkspaceAvatar,
  removeTeamAvatar,
  removeWorkspaceAvatar,
} from '@/lib/api';
import { avatarUploadOf } from '@/lib/avatar-image';
import { messageOf } from '@/lib/error';
import { required } from '@/lib/required';

export type AvatarChange = File | null;

const failure = (change: AvatarChange) =>
  change
    ? 'Sorry, the avatar couldn’t be uploaded.'
    : 'Sorry, the avatar couldn’t be removed.';

function useAvatarChange(
  slug: string | undefined,
  send: (change: AvatarChange) => Promise<{ error?: unknown }>,
): UseMutationResult<void, Error, AvatarChange> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (change: AvatarChange) => {
      const { error } = await send(change);

      if (error !== undefined) {
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

export function useWorkspaceAvatar(
  slug: string | undefined,
): UseMutationResult<void, Error, AvatarChange> {
  return useAvatarChange(slug, async (change) => {
    const path = { slug: required(slug) };

    return change
      ? setWorkspaceAvatar({ path, body: await avatarUploadOf(change) })
      : removeWorkspaceAvatar({ path });
  });
}

export function useTeamAvatar(
  slug: string | undefined,
  teamId: string | undefined,
): UseMutationResult<void, Error, AvatarChange> {
  return useAvatarChange(slug, async (change) => {
    const path = { teamId: required(teamId) };

    return change
      ? setTeamAvatar({ path, body: await avatarUploadOf(change) })
      : removeTeamAvatar({ path });
  });
}
