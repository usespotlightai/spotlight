import type { HookEventInstance } from '@integrations/application/ports/hook-runtime.port';
import { taskViewOf } from '@integrations/application/ports/tasks-for-hooks.fake-spec';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { usedTool } from '@integrations/domain/value-objects/hook-event-facts.fake-spec';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { CompiledHookRuntime } from '@integrations/infrastructure/hooks/hook.runtime';
import type {
  DrizzleHookDefinitionsReader,
  StoredHookDefinition,
} from '@integrations/infrastructure/persistence/drizzle/readers/hook-definitions.reader';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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
      // oxlint-disable-next-line no-template-curly-in-string -- how a hook expression is written
      with: { channel: 'C1', text: 'Searched ${{ event.inputs.query }}' },
    },
    {
      name: 'audit',
      request: { url: 'https://audit.example.com/' },
    },
    {
      name: 'labelled',
      request: {
        // oxlint-disable-next-line no-template-curly-in-string -- how a hook expression is written
        url: 'https://audit.example.com/${{ event.tool }}',
        // oxlint-disable-next-line no-template-curly-in-string -- how a hook expression is written
        headers: { 'X-Said': '${{ step.notify.status }}' },
        // oxlint-disable-next-line no-template-curly-in-string -- how a hook expression is written
        body: '${{ {"query": event.inputs.query} }}',
        from: 'network',
      },
    },
    {
      name: 'unwritten',
      // oxlint-disable-next-line no-template-curly-in-string -- how a hook expression is written
      request: { url: '${{ event.inputs.missing.deeper }}' },
    },
  ],
  signing: { secretVersion: 1 },
  timeoutSeconds: 2,
};

const INSTANCE: HookEventInstance = {
  on: 'tool.used',
  occurrence: HookOccurrenceKey.of('occurrence_1'),
  firing: null,
  run: null,
  at: NOW,
  event: usedTool('grafana.search', { inputs: { query: 'cpu' } }),
  task: taskViewOf({ title: 'Look at CPU' }),
};

const setUp = (document: Record<string, unknown> = DOCUMENT) => {
  const definition: StoredHookDefinition = {
    id: HookDefinitionId.of('hook_1'),
    key: HookKey.of('grafana-reads'),
    teamId: TEAM,
    document,
    blocks: document.failure === 'block',
    version: 1,
  };
  const hooks = {
    listening: vi.fn(async (_team: TeamId, on: string) =>
      on === 'tool.used' ? [definition] : [],
    ),
    withId: vi.fn(async () => definition),
  };

  return {
    hooks,
    hooked: new CompiledHookRuntime(
      hooks as unknown as DrizzleHookDefinitionsReader,
      new CelExpressionEngine(),
    ),
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
    expect(hook.written?.steps.map((step) => step.name.value)).toEqual([
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
        event: usedTool('grafana.search', { inputs: { query: 'memory' } }),
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
      hooked.written(
        await listened(hooked),
        HookStepName.of('notify'),
        INSTANCE,
        [],
      ),
    ).toEqual({
      kind: 'call',
      name: HookStepName.of('notify'),
      tool: ToolName.of('slack.post-message'),
      with: { channel: 'C1', text: 'Searched cpu' },
    });
  });

  it('sends the event, task and run when a request writes no body', async () => {
    const { hooked } = setUp();

    const written = hooked.written(
      await listened(hooked),
      HookStepName.of('audit'),
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
      HookStepName.of('labelled'),
      INSTANCE,
      [{ name: HookStepName.of('notify'), status: 'done', output: null }],
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
      hooked.written(
        await listened(hooked),
        HookStepName.of('unwritten'),
        INSTANCE,
        [],
      ),
    ).toMatchObject({
      kind: 'unwritable',
      name: HookStepName.of('unwritten'),
      failure: {
        code: 'unwritable',
        reason: expect.stringMatching(/^could not be written: /) as unknown,
      },
    });
  });

  it('cannot write out a step the hook no longer has', async () => {
    const { hooked } = setUp();

    expect(
      hooked.written(
        await listened(hooked),
        HookStepName.of('gone'),
        INSTANCE,
        [],
      ),
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
    expect(
      hooked.written(hook, HookStepName.of('notify'), INSTANCE, []),
    ).toMatchObject({
      kind: 'unwritable',
      failure: { code: 'broken' },
    });
  });
});
