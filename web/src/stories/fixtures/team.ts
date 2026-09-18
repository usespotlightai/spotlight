import type { QueryClient } from '@tanstack/react-query';
import { configurationKeys } from '@/hooks/api/useConfiguration';
import { inviteKeys } from '@/hooks/api/useInvites';
import { memberKeys } from '@/hooks/api/useMembers';
import { onboardingKeys } from '@/hooks/api/useOnboarding';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  ConfigurationResponseDto,
  InviteResponseDto,
  MemberResponseDto,
  OnboardingResponseDto,
  SetupStepResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const CONFIGURATION_REPOSITORY = 'acme/spotlight-config';

export const WORKSPACE: WorkspaceResponseDto = {
  id: 'workspace_acme',
  name: 'Acme',
  slug: SLUG,
  teams: [{ id: TEAM_ID, name: 'Platform' }],
  role: 'owner',
};

const step = (
  key: SetupStepResponseDto['key'],
  title: string,
): SetupStepResponseDto => ({
  key,
  title,
  description: title,
  where: null,
  done: true,
});

export const ONBOARDING: OnboardingResponseDto = {
  steps: [
    step('runner', 'Register a runner'),
    step('github', 'Install the GitHub App'),
    step('repository', 'Pick a configuration repository'),
    step('configuration', 'Write the configuration'),
    step('integrations', 'Choose integrations'),
  ],
  installUrl: 'https://github.com/apps/spotlight/installations/new',
  connectedToGitHub: true,
  configRepository: CONFIGURATION_REPOSITORY,
  repositoryOwner: 'acme',
  lines: [],
  integrations: [],
};

export const CONFIGURATION: ConfigurationResponseDto = {
  repository: CONFIGURATION_REPOSITORY,
  sha: '4f9c2e1a7b3d',
  integrations: [],
  readsFrom: CONFIGURATION_REPOSITORY,
  movingTo: null,
};

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
  client.setQueryData(configurationKeys.forTeam(TEAM_ID), CONFIGURATION);
  client.setQueryData(onboardingKeys.forTeam(TEAM_ID), ONBOARDING);
  client.setQueryData(memberKeys.forTeam(TEAM_ID), MEMBERS);
  client.setQueryData(inviteKeys.forTeam(TEAM_ID), INVITES);
};

export const failTeamGeneral = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  failQuery(client, configurationKeys.forTeam(TEAM_ID));
  failQuery(client, onboardingKeys.forTeam(TEAM_ID));
  failQuery(client, memberKeys.forTeam(TEAM_ID));
  failQuery(client, inviteKeys.forTeam(TEAM_ID));
};
