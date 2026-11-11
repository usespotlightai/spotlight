import type { AvatarResponseDto, SetAvatarRequestDto } from '@/lib/api';
import { api, json, noContent, notFound } from '@/mocks/http';
import { world } from '@/mocks/world';
import { avatars, WORKSPACE_AVATAR } from '@/mocks/world/avatars';

const dataUrlOf = (body: SetAvatarRequestDto) =>
  `data:${body.contentType};base64,${body.data}`;

const setTo = async (key: string, request: Request) => {
  const avatarUrl = dataUrlOf((await request.json()) as SetAvatarRequestDto);
  avatars().set(key, avatarUrl);

  return json<AvatarResponseDto>({ avatarUrl });
};

const ofWorkspace = (slug: unknown) => slug === world().workspace.slug;

const isTeam = (teamId: unknown) =>
  world().workspace.teams.some((team) => team.id === teamId);

export const avatarHandlers = [
  api.put('/workspaces/:slug/avatar', async ({ params, request }) => {
    if (!ofWorkspace(params.slug)) {
      return notFound();
    }

    return setTo(WORKSPACE_AVATAR, request);
  }),

  api.delete('/workspaces/:slug/avatar', ({ params }) => {
    if (!ofWorkspace(params.slug)) {
      return notFound();
    }

    avatars().delete(WORKSPACE_AVATAR);

    return noContent();
  }),

  api.put('/teams/:teamId/avatar', async ({ params, request }) => {
    if (!isTeam(params.teamId)) {
      return notFound();
    }

    return setTo(String(params.teamId), request);
  }),

  api.delete('/teams/:teamId/avatar', ({ params }) => {
    if (!isTeam(params.teamId)) {
      return notFound();
    }

    avatars().delete(String(params.teamId));

    return noContent();
  }),
];
