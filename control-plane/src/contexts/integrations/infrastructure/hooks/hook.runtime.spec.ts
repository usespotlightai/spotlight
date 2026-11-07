import type { HookEventInstance } from '@integrations/application/ports/hook-runtime.port';
import { taskViewOf } from '@integrations/application/ports/tasks-for-hooks.fake-spec';
import { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { CompiledHookRuntime } from '@integrations/infrastructure/hooks/hook.runtime';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const TEAM = TeamId.of('team_1');

const DOCUMENT = {
  key: 'grafana-reads',
  on: 'tool.used',
  match: { tools: ['grafana.search'] },
  when: "event.inputs.query == 'cpu'",
  steps: [
    {
      name: 'notify',
      call: 'slack.post-message',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
      with: { channel: 'C1', text: 'Searched ${{ event.inputs.query }}' },
    },
    { name: 'audit', request: { url: 'https://audit.example.com/' } },
    {
      name: 'labelled',
      request: {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
        url: 'https://audit.example.com/${{ event.tool }}',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
        headers: { 'X-Said': '${{ step.notify.status }}' },
        // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
        body: '${{ {"query": event.inputs.query} }}',
        from: 'network',
      },
    },
    {
      name: 'unwritten',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
      request: { url: '${{ event.inputs.missing.deeper }}' },
    },
  ],
  signing: { secretVersion: 1 },
  timeoutSeconds: 2,
};

const INSTANCE: HookEventInstance = {
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
  task: taskViewOf({ title: 'Look at CPU' }),
};

const setUp = (document: Record<string, unknown> = DOCUMENT) => {
  const definition = HookDefinition.rehydrate({
    id: HookDefinitionId.of('hook_1'),
    workspaceId: WorkspaceId.of('workspace_1'),
    teamId: TEAM,
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

  return {
    hooks,
    hooked: new CompiledHookRuntime(hooks, new CelExpressionEngine()),
  };
};

const listened = async (hooked: CompiledHookRuntime) => {
  const [hook] = await hooked.listening(TEAM, 'tool.used');

  if (!hook) throw new Error('no hook listens');

  return hook;
};

describe('CompiledHookRuntime', () => {
  it('lists the hooks of a team that listen to an event, compiled once per version', async () => {
    const { hooked } = setUp();

    const hook = await listened(hooked);

    expect(hook.id).toEqual(HookDefinitionId.of('hook_1'));
    expect(hook.key).toEqual(HookKey.of('grafana-reads'));
    expect(hook.written?.steps.map((step) => step.name)).toEqual([
      'notify',
      'audit',
      'labelled',
      'unwritten',
    ]);
    expect(await hooked.listening(TEAM, 'run.ended')).toEqual([]);
    expect(await listened(hooked)).toBe(hook);
  });

  it('finds a hook by its id', async () => {
    const { hooked, hooks } = setUp();

    await expect(
      hooked.hook(HookDefinitionId.of('hook_1')),
    ).resolves.toMatchObject({ key: HookKey.of('grafana-reads') });
    expect(hooks.withId).toHaveBeenCalledWith(HookDefinitionId.of('hook_1'));
  });

  it('holds when the when it was written with holds', async () => {
    const { hooked } = setUp();
    const hook = await listened(hooked);

    expect(hooked.whenHolds(hook, INSTANCE)).toBe(true);
    expect(
      hooked.whenHolds(hook, {
        ...INSTANCE,
        event: { ...INSTANCE.event, inputs: { query: 'memory' } },
      }),
    ).toBe(false);
  });

  it('holds for a hook written without a when', async () => {
    const { when: _, ...unconditional } = DOCUMENT;
    const { hooked } = setUp(unconditional);

    expect(hooked.whenHolds(await listened(hooked), INSTANCE)).toBe(true);
  });

  it('writes out the tool a call step names and the inputs it writes', async () => {
    const { hooked } = setUp();

    expect(
      hooked.written(await listened(hooked), 'notify', INSTANCE, []),
    ).toEqual({
      kind: 'call',
      name: 'notify',
      tool: ToolName.of('slack.post-message'),
      with: { channel: 'C1', text: 'Searched cpu' },
    });
  });

  it('sends the event, task and run when a request writes no body', async () => {
    const { hooked } = setUp();

    const written = hooked.written(
      await listened(hooked),
      'audit',
      INSTANCE,
      [],
    );

    if (written.kind !== 'request') throw new Error('not a request');
    expect(written.url).toEqual(new URL('https://audit.example.com/'));
    expect(written.signing).toEqual({ kind: 'hmac' });
    expect(written.fromNetwork).toBe(false);
    expect(JSON.parse(written.body)).toMatchObject({
      hook: 'grafana-reads',
      on: 'tool.used',
      occurrence: 'occurrence_1',
      event: { tool: 'grafana.search', at: NOW.toISOString() },
      task: { id: 'task_1', line: 'delivery' },
      run: { id: 'run_1' },
    });
  });

  it('writes out a request’s url, headers and body from the event and earlier steps', async () => {
    const { hooked } = setUp();

    const written = hooked.written(
      await listened(hooked),
      'labelled',
      INSTANCE,
      [{ name: 'notify', status: 'done', output: null }],
    );

    expect(written).toMatchObject({
      kind: 'request',
      url: new URL('https://audit.example.com/grafana.search'),
      headers: { 'x-said': 'done' },
      fromNetwork: true,
    });
    if (written.kind !== 'request') throw new Error('not a request');
    expect(JSON.parse(written.body)).toEqual({ query: 'cpu' });
  });

  it('cannot write out a step whose expressions fail', async () => {
    const { hooked } = setUp();

    expect(
      hooked.written(await listened(hooked), 'unwritten', INSTANCE, []),
    ).toMatchObject({
      kind: 'unwritable',
      name: 'unwritten',
      failure: {
        code: 'unwritable',
        reason: expect.stringMatching(/^could not be written: /),
      },
    });
  });

  it('cannot write out a step the hook no longer has', async () => {
    const { hooked } = setUp();

    expect(
      hooked.written(await listened(hooked), 'gone', INSTANCE, []),
    ).toMatchObject({
      kind: 'unwritable',
      failure: { code: 'broken', reason: 'is no longer a step of the hook' },
    });
  });

  it('tells whether a hook that no longer reads as written blocks by what it was written with', async () => {
    const { hooked } = setUp({
      ...DOCUMENT,
      when: 'no.such.thing ==',
      failure: 'block',
    });
    const hook = await listened(hooked);

    expect(hook.broken).not.toBeNull();
    expect(hook.written).toBeNull();
    expect(hook.blocks).toBe(true);
    expect(hooked.whenHolds(hook, INSTANCE)).toBe(false);
    expect(hooked.written(hook, 'notify', INSTANCE, [])).toMatchObject({
      kind: 'unwritable',
      failure: { code: 'broken' },
    });
  });
});
