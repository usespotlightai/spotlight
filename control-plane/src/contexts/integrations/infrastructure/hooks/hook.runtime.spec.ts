import type {
  HookMoment,
  StepAsked,
} from '@integrations/application/ports/hook-runtime.port';
import type {
  IntegrationRuntimePort,
  ReachableTool,
} from '@integrations/application/ports/integration-runtime.port';
import type { HostReach } from '@integrations/application/services/host-reach.service';
import { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import { ConnectionHolderRule } from '@integrations/domain/value-objects/connection-holder-rule.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import type { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { CompiledHookRuntime } from '@integrations/infrastructure/hooks/hook.runtime';
import type { HookRequests } from '@integrations/infrastructure/hooks/hook-requests';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const DOCUMENT = {
  key: 'grafana-reads',
  on: 'tool.used',
  match: { tools: ['grafana.search'] },
  steps: [
    {
      name: 'notify',
      call: 'slack.post-message',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
      with: { channel: 'C1', text: 'Searched ${{ event.inputs.query }}' },
    },
    { name: 'audit', request: { url: 'https://audit.example.com/' } },
    {
      name: 'plain',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
      request: { url: 'http://audit.example.com/${{ event.tool }}' },
    },
  ],
  signing: { secretVersion: 1 },
  timeoutSeconds: 2,
};

const MOMENT: HookMoment = {
  on: 'tool.used',
  occurrence: 'occurrence_1',
  firing: null,
  at: NOW,
  event: {
    tool: 'grafana.search',
    inputs: { query: 'cpu' },
    output: null,
    failed: false,
  },
  task: {
    taskId: 'task_1',
    workspaceId: 'workspace_1',
    teamId: 'team_1',
    title: 'Look at CPU',
    url: 'https://spotlight.example.com/t/1',
    line: 'delivery',
    station: 'Implementation',
    stationKey: 'implementation',
    marks: {},
    repositories: ['acme/api'],
    pullRequest: null,
    runId: 'run_1',
  },
};

const tool = (
  call: ReachableTool['call'],
  approval: { because: string } | null = null,
  holderRule: ConnectionHolderRule = ConnectionHolderRule.team(),
): ReachableTool =>
  ({
    integration: Integration.of({
      source: SourceKey.of('slack'),
      connects: holderRule.byRequester,
      holderRule,
    }),
    offered: OfferedTool.of({
      source: SourceKey.of('slack'),
      name: 'post-message',
      description: 'Post',
      backing: ToolBacking.action('post'),
      approval: approval ? ApprovalNeeded.of(approval, 'post-message') : null,
    }),
    declared: {
      tool: 'slack.post-message',
      description: 'Post',
      inputs: [
        {
          name: 'channel',
          type: 'string',
          description: null,
          required: true,
          defaulted: false,
          piped: false,
        },
        {
          name: 'text',
          type: 'string',
          description: null,
          required: true,
          defaulted: false,
          piped: false,
        },
      ],
      approval,
    },
    injectedSecrets: [],
    defaultFor: () => undefined,
    call,
  }) as unknown as ReachableTool;

const setUp = (
  reachable: ReachableTool | null,
  document: Record<string, unknown> = DOCUMENT,
) => {
  const definition = HookDefinition.rehydrate({
    id: HookDefinitionId.of('hook_1'),
    workspaceId: WorkspaceId.of('workspace_1'),
    teamId: TeamId.of('team_1'),
    key: HookKey.of('grafana-reads'),
    event: HookEvent.of('tool.used'),
    document: DefinitionDocument.of(document),
    tools: [ToolName.of('grafana.search'), ToolName.of('slack.post-message')],
    signing: { version: 1 },
    version: 1,
  });
  const hooks = {
    withId: vi.fn(async () => definition),
    of: vi.fn(),
    ofTeam: vi.fn(async () => [definition]),
    save: vi.fn(),
  } satisfies HookDefinitionRepository;
  const runtime = {
    tool: vi.fn(() => reachable),
  } as unknown as IntegrationRuntimePort;
  const requests = {
    sent: vi.fn(async (request: { step: string }) => ({
      outcome: { name: request.step, status: 'done' as const, output: null },
      denyReason: null,
      trace: null,
    })),
    notSent: vi.fn((request: { step: string }, failure: HookFailure) => ({
      outcome: {
        name: request.step,
        status: 'failed' as const,
        code: failure.code,
        reason: failure.reason,
        output: null,
      },
      denyReason: null,
      trace: null,
    })),
  };
  let now = NOW;

  return {
    requests,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    hooked: new CompiledHookRuntime(
      hooks,
      new CelExpressionEngine(),
      { ofTeam: vi.fn(async () => []) } as never,
      runtime,
      {
        of: vi.fn(async () => ({ connection: null, credentials: {} })),
      } as unknown as HostReach,
      requests as unknown as HookRequests,
      { now: () => now, sleep: async () => {} },
    ),
  };
};

const asking = async (
  hooked: CompiledHookRuntime,
  step: string,
  overrides: Partial<StepAsked> = {},
): Promise<StepAsked> => {
  const [hook] = await hooked.listening('team_1', 'tool.used');

  return {
    hook: hook as NonNullable<typeof hook>,
    step,
    moment: MOMENT,
    earlier: [],
    resuming: null,
    deadline: new Date(NOW.getTime() + 2_000),
    waiting: 'until-answered',
    ...overrides,
  };
};

describe('CompiledHookRuntime', () => {
  it('calls the tool with the inputs its step writes, tracing what went and came back', async () => {
    const call = vi.fn(async () => ({ ok: true }));
    const { hooked } = setUp(tool(call));

    const taken = await hooked.step(await asking(hooked, 'notify'));

    expect(call).toHaveBeenCalledWith(
      { channel: 'C1', text: 'Searched cpu' },
      expect.anything(),
    );
    expect(taken.outcome).toEqual({
      name: 'notify',
      status: 'done',
      output: { ok: true },
    });
    expect(taken.trace).toMatchObject({
      kind: 'call',
      target: 'slack.post-message',
      request: { channel: 'C1', text: 'Searched cpu' },
      response: { ok: true },
    });
  });

  it('fails a call that outlasts the hook', async () => {
    const { hooked } = setUp(tool(() => new Promise(() => {})));

    const taken = await hooked.step(
      await asking(hooked, 'notify', {
        deadline: new Date(NOW.getTime() + 20),
      }),
    );

    expect(taken.outcome).toMatchObject({
      status: 'failed',
      code: 'timeout',
      reason: "took longer than the hook's 2 seconds",
    });
  });

  it('fails a call the tool itself failed, as one worth trying again', async () => {
    const { hooked } = setUp(
      tool(() => Promise.reject(new Error('channel_not_found'))),
    );

    const taken = await hooked.step(await asking(hooked, 'notify'));

    expect(taken.outcome).toMatchObject({
      status: 'failed',
      code: 'tool-failed',
      reason: 'channel_not_found',
    });
  });

  it('does not call a tool that asks a person first', async () => {
    const call = vi.fn();
    const { hooked } = setUp(tool(call, { because: 'It posts publicly' }));

    const taken = await hooked.step(await asking(hooked, 'notify'));

    expect(call).not.toHaveBeenCalled();
    expect(taken.outcome).toMatchObject({
      status: 'failed',
      code: 'not-allowed',
      reason: expect.stringMatching(/approval/),
    });
  });

  it('does not call a tool that acts as the person who started a task', async () => {
    const call = vi.fn();
    const { hooked } = setUp(
      tool(call, null, ConnectionHolderRule.requester()),
    );

    const taken = await hooked.step(await asking(hooked, 'notify'));

    expect(call).not.toHaveBeenCalled();
    expect(taken.outcome).toMatchObject({
      status: 'failed',
      code: 'not-allowed',
      reason: expect.stringMatching(/A hook acts as nobody/),
    });
  });

  it('fails a tool the team no longer offers, saying so', async () => {
    const { hooked } = setUp(null);

    await expect(
      hooked.step(await asking(hooked, 'notify')),
    ).resolves.toMatchObject({
      outcome: {
        status: 'failed',
        code: 'not-allowed',
        reason:
          'names slack.post-message, which no integration of the team offers now',
      },
    });
  });

  it('does not start a step past the hook’s deadline', async () => {
    const { hooked, requests } = setUp(tool(vi.fn()));

    const taken = await hooked.step(
      await asking(hooked, 'audit', { deadline: new Date(NOW.getTime() - 1) }),
    );

    expect(requests.sent).not.toHaveBeenCalled();
    expect(taken.outcome).toMatchObject({
      status: 'failed',
      code: 'timeout',
      reason: "was not reached within the hook's 2 seconds",
    });
  });

  it('asks for steps by name, and fails one the hook no longer has', async () => {
    const { hooked, requests } = setUp(tool(vi.fn()));

    await hooked.step(await asking(hooked, 'audit'));
    const gone = await hooked.step(await asking(hooked, 'gone'));

    expect(requests.sent).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'audit',
        url: 'https://audit.example.com/',
        signing: { kind: 'hmac' },
      }),
      NOW,
    );
    expect(gone.outcome).toMatchObject({
      status: 'failed',
      code: 'broken',
      reason: 'is no longer a step of the hook',
    });
  });

  it('sends the event, task and run when a request writes no body', async () => {
    const { hooked, requests } = setUp(tool(vi.fn()));

    await hooked.step(await asking(hooked, 'audit'));

    const [sent] = requests.sent.mock.calls[0] as unknown as [{ body: string }];
    expect(JSON.parse(sent.body)).toMatchObject({
      hook: 'grafana-reads',
      on: 'tool.used',
      occurrence: 'occurrence_1',
      event: { tool: 'grafana.search', at: NOW.toISOString() },
      task: { id: 'task_1', line: 'delivery' },
      run: { id: 'run_1' },
    });
  });

  it('matches only what its match and when allow', async () => {
    const { hooked } = setUp(tool(vi.fn()));
    const [hook] = await hooked.listening('team_1', 'tool.used');

    expect(hooked.matches(hook as never, MOMENT)).toBe(true);
    expect(
      hooked.matches(hook as never, {
        ...MOMENT,
        event: { ...MOMENT.event, tool: 'grafana.dashboard' },
      }),
    ).toBe(false);
  });

  it('never sends a request in the clear from Spotlight once its url is written out', async () => {
    const { hooked, requests } = setUp(tool(vi.fn()));

    await expect(
      hooked.step(await asking(hooked, 'plain')),
    ).resolves.toMatchObject({
      outcome: {
        status: 'failed',
        code: 'not-allowed',
        reason: 'sends to http://audit.example.com, which is not https',
      },
    });
    expect(requests.sent).not.toHaveBeenCalled();
  });

  it('tells whether a hook that no longer reads as written blocks by what it was written with', async () => {
    const { hooked } = setUp(tool(vi.fn()), {
      ...DOCUMENT,
      when: 'no.such.thing ==',
      failure: 'block',
    });
    const [hook] = await hooked.listening('team_1', 'tool.used');

    expect(hook?.broken).not.toBeNull();
    expect(hook?.written).toBeNull();
    expect(hook?.blocks).toBe(true);
  });
});
