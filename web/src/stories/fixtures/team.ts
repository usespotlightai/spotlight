import type { QueryClient } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useInvites';
import { memberKeys } from '@/hooks/api/useMembers';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  ConfigurationResponseDto,
  InviteResponseDto,
  MemberResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';

export const WORKSPACE: WorkspaceResponseDto = {
  id: 'workspace_acme',
  name: 'Acme',
  slug: SLUG,
  teams: [{ id: TEAM_ID, name: 'Platform' }],
  role: 'owner',
};

export const CONFIGURATION: ConfigurationResponseDto = { integrations: [] };

const MEMBERS: MemberResponseDto[] = [
  {
    id: 'user_1',
    name: 'Sam Rivera',
    image: null,
    role: 'owner',
    mayBeSetTo: [],
  },
  {
    id: 'user_2',
    name: 'Ada Lovelace',
    image: null,
    role: 'admin',
    mayBeSetTo: ['owner', 'admin', 'member'],
  },
  {
    id: 'user_3',
    name: 'Grace Hopper',
    image: null,
    role: 'member',
    mayBeSetTo: ['owner', 'admin', 'member'],
  },
];

const INVITES: InviteResponseDto[] = [
  {
    id: 'invite_1',
    email: 'linus@example.com',
    invitedBy: 'Sam Rivera',
    invitedAt: '2026-09-12T09:00:00.000Z',
    expiresAt: '2026-09-26T09:00:00.000Z',
  },
];

export const seedTeamGeneral = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(memberKeys.forTeam(TEAM_ID), MEMBERS);
  client.setQueryData(inviteKeys.forTeam(TEAM_ID), INVITES);
};

export const failTeamGeneral = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  failQuery(client, memberKeys.forTeam(TEAM_ID));
  failQuery(client, inviteKeys.forTeam(TEAM_ID));
};
