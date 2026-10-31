import { HttpResponse, type RequestHandler } from 'msw';
import type {
  ConnectGitHubRequestDto,
  ConnectIntegrationRequestDto,
  CreateRunnerPoolData,
  CreateWorkspaceRequestDto,
  CreateWorkspaceTokenData,
  IntegrationViewResponseDto,
  OnboardingResponseDto,
  SetToolRuleRequestDto,
} from '@/lib/api';
import { daysAgo } from '@/mocks/clock';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { scenario } from '@/mocks/scenario';
import { world } from '@/mocks/world';
import {
  HARNESSES,
  INSTALL_URL,
  REPOSITORIES,
  SIGNED_IN,
  settingsWorld,
  type TeamConnections,
  toolRules,
  WORKSPACE_ID,
  workspaceToken,
} from '@/mocks/world/settings';
import { newRunnerPool } from '@/mocks/world/settings-runners';
import { teamChats } from '@/mocks/world/team-chats';

const SECRET = 'q3Vd0n8yXbT2c4kPzR7mW1sLhA9eJ5gUfN6oYiC0xEw';

const created = <T>(body: T, header: string) =>
  HttpResponse.json(body as never, {
    status: 201,
    headers: { [header]: SECRET },
  });

const ofWorkspace = (slug: unknown) => slug === world().workspace.slug;

const ofWorkspaceId = (id: unknown) => id === WORKSPACE_ID;

const isTeam = (teamId: string) =>
  world().workspace.teams.some((team) => team.id === teamId);

const teamName = (teamId: string) =>
  world().workspace.teams.find((team) => team.id === teamId)?.name ?? '';

const connectionsOf = (teamId: string): TeamConnections => {
  const store = settingsWorld().connections;
  store[teamId] ??= { mine: [], people: [] };
  return store[teamId];
};

const configured = (teamId: string): IntegrationViewResponseDto[] =>
  settingsWorld().integrations[teamId] ?? [];

const setupChatOf = (teamId: string): OnboardingResponseDto['setupChat'] => {
  const chats = (teamChats()[teamId] ?? []).flatMap(({ chat }) =>
    chat.setup
      ? [
          {
            id: chat.id,
            repository: chat.setup.repository,
            pullRequest: chat.setup.pullRequest,
            ci: settingsWorld().setupCi,
            startedBy: SIGNED_IN.name,
          },
        ]
      : [],
  );

  return chats.find((each) => each.pullRequest) ?? chats[0] ?? null;
};

const onboarding = (teamId: string): OnboardingResponseDto => ({
  provisioning: settingsWorld().settingUp.includes(teamId) ? 'pending' : 'done',
  steps: [
    {
      key: 'github',
      title: 'Install the GitHub App',
      description:
        'So Spotlight can read your repositories and open pull requests.',
      done: settingsWorld().gitHubConnected,
    },
    {
      key: 'harness',
      title: 'Connect a host',
      description:
        'A runner with an agent harness installed, such as Claude Code.',
      done: settingsWorld().fleet.runners.some(
        (runner) => runner.harnesses.length > 0,
      ),
    },
    {
      key: 'configuration',
      title: 'Set up configuration as code',
      description:
        'Pick a repository and folder for the team’s Terraform, and the repositories the team works in. The agent learns how the team works from its code and tools, then opens a pull request.',
      done: Boolean(setupChatOf(teamId)?.pullRequest),
    },
  ],
  canSetUp:
    settingsWorld().gitHubConnected && settingsWorld().fleet.hosts.length > 0,
  viewerIsAdmin: settingsWorld().viewerIsAdmin,
  setupChat: setupChatOf(teamId),
});

const linkedAccountOf = (integration: string) =>
  integration === 'sentry' ? 'sam.rivera@acme.dev' : '@sam';

const resourceHandlers = [
  api.get('/v1/resources/teams/:id', ({ params }) => {
    const teamId = String(params.id);
    if (!isTeam(teamId)) {
      return notFound();
    }

    const key = teamName(teamId).toLowerCase();
    return json({
      id: teamId,
      version: 1,
      address: key,
      warnings: [],
      workspaceId: WORKSPACE_ID,
      key,
      name: teamName(teamId),
    });
  }),

  api.post('/v1/resources/workspaces', async ({ request }) => {
    const { name, slug } = (await request.json()) as {
      name: string;
      slug: string;
    };
    if (ofWorkspace(slug)) {
      return problem(409, `Sorry, the address ${slug} is taken.`);
    }

    return json(
      {
        id: `workspace_${slug}`,
        version: 1,
        address: slug,
        warnings: [],
        name,
        slug,
      },
      201,
    );
  }),

  api.get('/v1/resources/workspaces/:workspaceId/runner-pools', ({ params }) =>
    ofWorkspaceId(params.workspaceId)
      ? json({ items: settingsWorld().pools })
      : notFound(),
  ),

  api.post(
    '/v1/resources/workspaces/:workspaceId/runner-pools',
    async ({ params, request }) => {
      if (!ofWorkspaceId(params.workspaceId)) {
        return notFound();
      }

      const { key } = (await request.json()) as CreateRunnerPoolData['body'];
      const pools = settingsWorld().pools;
      if (pools.some((each) => each.key === key)) {
        return problem(409, `Sorry, pool ${key} already exists.`);
      }

      const pool = newRunnerPool(key);
      pools.push(pool);
      return created(pool, 'Spotlight-Pool-Token');
    },
  ),

  api.get('/v1/resources/workspaces/:workspaceId/tokens', ({ params }) =>
    ofWorkspaceId(params.workspaceId)
      ? json({ items: settingsWorld().tokens })
      : notFound(),
  ),

  api.get('/workspaces/:slug/oidc-trusts', ({ params }) =>
    ofWorkspace(params.slug) && scenario().account !== 'member'
      ? json(settingsWorld().oidcTrusts)
      : notFound(),
  ),

  api.post(
    '/v1/resources/workspaces/:workspaceId/tokens',
    async ({ params, request }) => {
      if (!ofWorkspaceId(params.workspaceId)) {
        return notFound();
      }

      const spec = (await request.json()) as CreateWorkspaceTokenData['body'];
      const tokens = settingsWorld().tokens;
      if (tokens.some((each) => each.name === spec.name)) {
        return problem(409, `Sorry, token ${spec.name} already exists.`);
      }

      const token = workspaceToken(spec.name, {
        description: spec.description ?? '',
        scopes: spec.scopes,
        expiresAt: spec.expiresAt ?? null,
      });
      tokens.unshift(token);
      return created(token, 'Spotlight-Workspace-Token');
    },
  ),

  api.delete('/v1/resources/tokens/:id', ({ params }) => {
    const store = settingsWorld();
    if (!store.tokens.some((each) => each.id === params.id)) {
      return notFound();
    }

    store.tokens = store.tokens.filter((each) => each.id !== params.id);
    return noContent();
  }),
];

const teamHandlers = [
  api.get('/teams/:teamId/configuration', ({ params }) =>
    isTeam(String(params.teamId))
      ? json({ integrations: configured(String(params.teamId)) })
      : notFound(),
  ),

  api.get('/teams/:teamId/configuration/onboarding', ({ params }) =>
    isTeam(String(params.teamId))
      ? json(onboarding(String(params.teamId)))
      : notFound(),
  ),

  api.get('/teams/:teamId/connections', ({ params }) =>
    isTeam(String(params.teamId))
      ? json(connectionsOf(String(params.teamId)))
      : notFound(),
  ),

  api.post(
    '/teams/:teamId/integrations/:integration/connect',
    async ({ params, request }) => {
      const teamId = String(params.teamId);
      const integrationKey = String(params.integration);
      const integration = settingsWorld().integrations[teamId]?.find(
        (each) => each.integration === integrationKey,
      );
      if (!integration) {
        return notFound();
      }

      const body = (await request
        .json()
        .catch(() => ({}))) as ConnectIntegrationRequestDto;
      const connections = connectionsOf(teamId);
      if (body.actsAs === 'requester') {
        const linkedAccount = linkedAccountOf(integrationKey);
        connections.mine = [
          ...connections.mine.filter(
            (each) => each.integration !== integrationKey,
          ),
          {
            integration: integrationKey,
            linkedAccount,
            connectedAt: daysAgo(0),
            tools: toolRules(integrationKey),
          },
        ];
        connections.people = [
          ...connections.people.filter(
            (each) =>
              each.integration !== integrationKey ||
              each.personId !== SIGNED_IN.id,
          ),
          {
            integration: integrationKey,
            linkedAccount,
            connectedAt: daysAgo(0),
            personId: SIGNED_IN.id,
            name: SIGNED_IN.name,
          },
        ];
      } else {
        integration.connectionStatus = 'connected';
        integration.linkedAccount = 'Acme';
      }

      return json({ url: globalThis.location.href });
    },
  ),

  api.delete(
    '/teams/:teamId/integrations/:integration/connections/mine',
    ({ params }) => {
      const connections = connectionsOf(String(params.teamId));
      const integrationKey = String(params.integration);
      if (
        !connections.mine.some((each) => each.integration === integrationKey)
      ) {
        return notFound();
      }

      connections.mine = connections.mine.filter(
        (each) => each.integration !== integrationKey,
      );
      connections.people = connections.people.filter(
        (each) =>
          each.integration !== integrationKey || each.personId !== SIGNED_IN.id,
      );
      return noContent();
    },
  ),

  api.put(
    '/teams/:teamId/integrations/:integration/connections/mine/tools/:tool',
    async ({ params, request }) => {
      const mine = connectionsOf(String(params.teamId)).mine.find(
        (each) => each.integration === params.integration,
      );
      if (!mine) {
        return notFound();
      }

      const { rule } = (await request.json()) as SetToolRuleRequestDto;
      const tool = String(params.tool);
      mine.tools = [
        ...mine.tools.filter((each) => each.tool !== tool),
        { tool, rule },
      ];
      return noContent();
    },
  ),

  api.get('/teams/:teamId/skills', ({ params }) =>
    isTeam(String(params.teamId))
      ? json({ skills: settingsWorld().skills[String(params.teamId)] ?? [] })
      : notFound(),
  ),
];

const workspaceHandlers = [
  api.post('/workspaces', async ({ request }) => {
    const {
      name,
      slug,
      teamName: firstTeam,
    } = (await request.json()) as CreateWorkspaceRequestDto;
    if (ofWorkspace(slug)) {
      return problem(409, `Sorry, the address ${slug} is taken.`);
    }

    return json(
      {
        id: `workspace_${slug}`,
        name,
        slug,
        teams: [{ id: `team_${slug}`, name: firstTeam }],
      },
      201,
    );
  }),

  api.get('/workspaces/:slug/github', ({ params }) =>
    ofWorkspace(params.slug)
      ? json({
          connected: settingsWorld().gitHubConnected,
          installUrl: INSTALL_URL,
        })
      : notFound(),
  ),

  api.post('/workspaces/:slug/github', async ({ params, request }) => {
    if (!ofWorkspace(params.slug)) {
      return notFound();
    }

    const { installationId } =
      (await request.json()) as ConnectGitHubRequestDto;
    if (!installationId) {
      return problem(400, 'Sorry, that installation is missing its id.');
    }

    settingsWorld().gitHubConnected = true;
    return noContent();
  }),

  api.get('/workspaces/:slug/harnesses', ({ params }) =>
    ofWorkspace(params.slug) ? json(HARNESSES) : notFound(),
  ),

  api.get('/workspaces/:slug/repositories', ({ params }) => {
    if (!ofWorkspace(params.slug)) {
      return notFound();
    }

    return json(
      settingsWorld().gitHubConnected
        ? REPOSITORIES.map((fullName) => ({ fullName }))
        : [],
    );
  }),

  api.get('/workspaces/:slug/runners', ({ params }) => {
    if (!ofWorkspace(params.slug)) {
      return notFound();
    }

    const { hosts, runners } = settingsWorld().fleet;
    return json({ hosts, runners });
  }),

  api.delete('/workspaces/:slug/runners/hosts/:hostId', ({ params }) => {
    const { fleet } = settingsWorld();
    if (
      !ofWorkspace(params.slug) ||
      !fleet.hosts.some((each) => each.id === params.hostId)
    ) {
      return notFound();
    }

    fleet.hosts = fleet.hosts.filter((each) => each.id !== params.hostId);
    return noContent();
  }),

  api.get('/workspaces/:slug/runner-activity', ({ params }) =>
    ofWorkspace(params.slug)
      ? json(settingsWorld().fleet.activity)
      : notFound(),
  ),
];

export const settingsHandlers: RequestHandler[] = [
  ...resourceHandlers,
  ...teamHandlers,
  ...workspaceHandlers,
];
