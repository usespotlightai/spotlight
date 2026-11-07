import type { HookRequestsPort } from '@integrations/application/ports/hook-requests.port';
import type {
  HookEventInstance,
  ListeningHook,
  StepRequest,
  StepResult,
  WrittenStep,
} from '@integrations/application/ports/hook-runtime.port';
import type {
  CallAttempt,
  IntegrationRuntimePort,
  ResolvedTool,
} from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { HookCallbackTokens } from '@integrations/application/services/hook-callback-tokens.service';
import {
  clock,
  logger,
  NOW,
  runtimeOf,
  TASK,
} from '@integrations/application/services/hook-firings.fake-spec';
import { HookSteps } from '@integrations/application/services/hook-steps.service';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import { Hook } from '@integrations/domain/value-objects/hook.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { usedTool } from '@integrations/domain/value-objects/hook-event-facts.fake-spec';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookMatch } from '@integrations/domain/value-objects/hook-match.vo';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import { HookRunAttempt } from '@integrations/domain/value-objects/hook-run-attempt.vo';
import { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import { Integration } from '@integrations/domain/value-objects/integration.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const POST = ToolName.of('slack.post-message');

const EVENT = HookEvent.of('tool.used');

const HOOK: ListeningHook = {
  id: HookDefinitionId.of('hook_1'),
  key: HookKey.of('grafana-reads'),
  teamId: TeamId.of('team_1'),
  blocks: false,
  compiled: null,
  broken: null,
  written: Hook.of({
    key: HookKey.of('grafana-reads'),
    event: EVENT,
    match: HookMatch.anything(EVENT),
    steps: [
      { name: HookStepName.of('notify'), kind: 'call', tool: POST },
      {
        name: HookStepName.of('audit'),
        kind: 'request',
        url: new URL('https://audit.example.com/'),
        headers: [],
        fromNetwork: false,
      },
      {
        name: HookStepName.of('plain'),
        kind: 'request',
        url: null,
        headers: [],
        fromNetwork: false,
      },
    ],
    signing: 'hmac',
    failure: 'continue',
    timeoutSeconds: 2,
  }),
};

const INSTANCE: HookEventInstance = {
  on: 'tool.used',
  occurrence: HookOccurrenceKey.of('occurrence_1'),
  firing: HookFiringId.of('firing_1'),
  run: HookRunAttempt.of(RunId.of('run_1'), 2),
  at: NOW,
  event: usedTool('grafana.search'),
  task: TASK,
};

const CALL: WrittenStep = {
  kind: 'call',
  name: HookStepName.of('notify'),
  tool: POST,
  with: { channel: 'C1', text: 'Searched cpu' },
};

const AUDIT: WrittenStep = {
  kind: 'request',
  name: HookStepName.of('audit'),
  url: new URL('https://audit.example.com/'),
  headers: { 'x-team': 'core' },
  body: '{}',
  fromNetwork: false,
  signing: { kind: 'hmac' },
};

const answered = (name: HookStepName): StepResult => ({
  outcome: { name, status: 'done', output: null },
  denyReason: null,
  trace: null,
});

const resolvedTool = (
  attempt: () => Promise<CallAttempt>,
  {
    approval = null,
    actsAs = ActsAs.team(),
  }: { approval?: { because: string } | null; actsAs?: ActsAs } = {},
): ResolvedTool =>
  ({
    integration: Integration.of({
      key: IntegrationKey.of('slack'),
      apiSpecs: ['mcp'],
      connectsOver: actsAs.byRequester ? 'oauth2' : null,
      actsAs,
    }),
    provided: ProvidedTool.of({
      integration: IntegrationKey.of('slack'),
      name: 'post-message',
      description: 'Post',
      inputs: ['channel', 'text'].map((name) => ({
        name,
        schema: InputSchema.ofType('string'),
        description: null,
        required: true,
        defaulted: false,
        stdin: false,
      })),
      backing: ToolBacking.action('post'),
      approval: approval ? ApprovalNeeded.of(approval, 'post-message') : null,
    }),
    injectedSecrets: [],
    defaultFor: () => undefined,
    call: vi.fn(),
    attempt: vi.fn(attempt),
  }) as unknown as ResolvedTool;

const setUp = (
  written: WrittenStep | null,
  resolved: ResolvedTool | null = null,
) => {
  const runtime = runtimeOf([HOOK]);
  if (written) {
    runtime.written.mockImplementation(() => written);
  }
  const requests = {
    sent: vi.fn(async (request: { step: HookStepName }) =>
      answered(request.step),
    ),
    resumed: vi.fn(
      async (request: { step: HookStepName }): Promise<StepResult | null> =>
        answered(request.step),
    ),
    unanswered: vi.fn(
      (request: { step: HookStepName }): StepResult => ({
        outcome: {
          name: request.step,
          status: 'failed',
          code: 'unreachable',
          reason: 'no host of the workspace answered in time',
          output: null,
        },
        denyReason: null,
        trace: null,
      }),
    ),
    notSent: vi.fn(
      (request: { step: HookStepName }, failure: HookFailure): StepResult => ({
        outcome: {
          name: request.step,
          status: 'failed',
          code: failure.code,
          reason: failure.reason,
          output: null,
        },
        denyReason: null,
        trace: null,
      }),
    ),
  } satisfies HookRequestsPort;
  const tool = vi.fn(async () => resolved);
  const issued = vi.fn(async () => 'callback_token');
  const callAuth = vi.fn(async () => ({ connection: null, credentials: {} }));
  const record = vi.fn(async () => {});

  return {
    runtime,
    requests,
    tool,
    issued,
    callAuth,
    record,
    steps: new HookSteps(
      runtime,
      requests,
      { ofTeam: vi.fn(async () => []) } as never,
      { tool } as unknown as IntegrationRuntimePort,
      { of: callAuth } as unknown as CallAuthResolver,
      { issued } as unknown as HookCallbackTokens,
      { record },
      clock,
      logger(),
    ),
  };
};

const request = (
  step: string,
  overrides: Partial<StepRequest> = {},
): StepRequest => ({
  hook: HOOK,
  step: HookStepName.of(step),
  instance: INSTANCE,
  earlier: [],
  resuming: null,
  deadline: new Date(NOW.getTime() + 2_000),
  waitMode: 'wait',
  ...overrides,
});

describe('HookSteps', () => {
  describe('before a step starts', () => {
    it('fails a step of a hook that no longer reads as it was written', async () => {
      const { steps, runtime } = setUp(CALL);

      await expect(
        steps.take(
          request('notify', {
            hook: { ...HOOK, broken: 'gone', written: null },
          }),
        ),
      ).resolves.toMatchObject({
        outcome: {
          status: 'failed',
          code: 'broken',
          reason: 'belongs to a hook that no longer reads as it was written',
        },
      });
      expect(runtime.written).not.toHaveBeenCalled();
    });

    it('fails a step the hook no longer has', async () => {
      const { steps } = setUp(CALL);

      await expect(steps.take(request('gone'))).resolves.toMatchObject({
        outcome: {
          status: 'failed',
          code: 'broken',
          reason: 'is no longer a step of the hook',
        },
      });
    });

    it('does not start a step past the hook’s deadline', async () => {
      const { steps, requests } = setUp(AUDIT);

      await expect(
        steps.take(request('audit', { deadline: new Date(NOW.getTime() - 1) })),
      ).resolves.toMatchObject({
        outcome: {
          status: 'failed',
          code: 'timeout',
          reason: "did not start within the hook's 2 seconds",
        },
      });
      expect(requests.sent).not.toHaveBeenCalled();
    });

    it('fails a step it cannot write out', async () => {
      const { steps } = setUp({
        kind: 'unwritable',
        name: HookStepName.of('audit'),
        failure: HookFailure.unwritable('no such key: missing'),
      });

      await expect(steps.take(request('audit'))).resolves.toMatchObject({
        outcome: {
          status: 'failed',
          code: 'unwritable',
          reason: 'could not be written: no such key: missing',
        },
      });
    });
  });

  describe('calling a tool', () => {
    it('calls the tool with the inputs its step writes, tracing what went and came back', async () => {
      const resolved = resolvedTool(async () => ({
        kind: 'answered',
        output: { ok: true },
      }));
      const { steps, callAuth } = setUp(CALL, resolved);

      const stepResult = await steps.take(request('notify'));

      expect(resolved.attempt).toHaveBeenCalledWith(
        { channel: 'C1', text: 'Searched cpu' },
        { connection: null, credentials: {} },
        2_000,
      );
      expect(callAuth).toHaveBeenCalledWith(
        TeamId.of('team_1'),
        resolved.integration,
      );
      expect(stepResult.outcome).toEqual({
        name: HookStepName.of('notify'),
        status: 'done',
        output: { ok: true },
      });
      expect(stepResult.trace).toMatchObject({
        hook: 'grafana-reads',
        kind: 'call',
        target: 'slack.post-message',
        request: { channel: 'C1', text: 'Searched cpu' },
        response: { ok: true },
        failed: false,
      });
    });

    it('fails a call that outlasts the hook', async () => {
      const { steps } = setUp(
        CALL,
        resolvedTool(async () => ({ kind: 'timed-out' })),
      );

      await expect(steps.take(request('notify'))).resolves.toMatchObject({
        outcome: {
          status: 'failed',
          code: 'timeout',
          reason: "took longer than the hook's 2 seconds",
        },
        trace: { failed: true },
      });
    });

    it.each<[CallAttempt, string]>([
      [
        {
          kind: 'failed',
          fact: {
            kind: 'upstream',
            status: 503,
            transient: true,
            reason: 'down',
          },
        },
        'server-error',
      ],
      [
        {
          kind: 'failed',
          fact: {
            kind: 'upstream',
            status: 404,
            transient: true,
            reason: 'gone',
          },
        },
        'rejected',
      ],
      [
        {
          kind: 'failed',
          fact: { kind: 'unknown', reason: 'channel_not_found' },
        },
        'tool-failed',
      ],
      [
        { kind: 'failed', fact: { kind: 'blocked', reason: 'blocked' } },
        'not-allowed',
      ],
    ])('reads a failed call %j as %s', async (attempt, code) => {
      const { steps } = setUp(
        CALL,
        resolvedTool(async () => attempt),
      );

      await expect(steps.take(request('notify'))).resolves.toMatchObject({
        outcome: { status: 'failed', code },
      });
    });

    it('does not call a tool that asks a person first', async () => {
      const resolved = resolvedTool(async () => ({ kind: 'timed-out' }), {
        approval: { because: 'It posts publicly' },
      });
      const { steps } = setUp(CALL, resolved);

      await expect(steps.take(request('notify'))).resolves.toMatchObject({
        outcome: {
          status: 'failed',
          code: 'not-allowed',
          reason: expect.stringMatching(/approval/),
        },
      });
      expect(resolved.attempt).not.toHaveBeenCalled();
    });

    it('does not call a tool that acts as the person who started a task', async () => {
      const resolved = resolvedTool(async () => ({ kind: 'timed-out' }), {
        actsAs: ActsAs.requester(),
      });
      const { steps, callAuth } = setUp(CALL, resolved);

      await expect(steps.take(request('notify'))).resolves.toMatchObject({
        outcome: {
          status: 'failed',
          code: 'not-allowed',
          reason: expect.stringMatching(/A hook acts as nobody/),
        },
      });
      expect(resolved.attempt).not.toHaveBeenCalled();
      expect(callAuth).not.toHaveBeenCalled();
    });

    it('fails a tool the team no longer offers, saying so', async () => {
      const { steps } = setUp(CALL, null);

      await expect(steps.take(request('notify'))).resolves.toMatchObject({
        outcome: {
          status: 'failed',
          code: 'not-allowed',
          reason:
            'names slack.post-message, which no integration of the team offers now',
        },
      });
    });

    it('cannot write inputs the tool does not take', async () => {
      const resolved = resolvedTool(async () => ({ kind: 'timed-out' }));
      const { steps } = setUp({ ...CALL, with: { channel: 'C1' } }, resolved);

      await expect(steps.take(request('notify'))).resolves.toMatchObject({
        outcome: {
          status: 'failed',
          code: 'unwritable',
          reason:
            'could not be written: slack.post-message needs its text input',
        },
      });
      expect(resolved.attempt).not.toHaveBeenCalled();
    });
  });

  describe('making a request', () => {
    it('sends what the step writes, with a callback token issued for the task and firing', async () => {
      const { steps, requests, issued } = setUp(AUDIT);

      await steps.take(request('audit'));

      expect(issued).toHaveBeenCalledWith({
        workspaceId: TASK.workspaceId,
        taskId: TASK.taskId,
        hook: HOOK.key,
        firing: HookFiringId.of('firing_1'),
      });
      expect(requests.sent).toHaveBeenCalledWith(
        expect.objectContaining({
          step: HookStepName.of('audit'),
          url: 'https://audit.example.com/',
          headers: { 'x-team': 'core' },
          signing: { kind: 'hmac' },
          waitMode: 'wait',
        }),
        'callback_token',
        NOW,
      );
    });

    it('never sends a request in the clear from Spotlight once its url is written out', async () => {
      const { steps, requests, issued } = setUp({
        ...AUDIT,
        name: HookStepName.of('plain'),
        url: new URL('http://audit.example.com/grafana.search'),
      });

      await expect(steps.take(request('plain'))).resolves.toMatchObject({
        outcome: {
          status: 'failed',
          code: 'not-allowed',
          reason: 'sends to http://audit.example.com, which is not https',
        },
      });
      expect(requests.sent).not.toHaveBeenCalled();
      expect(issued).not.toHaveBeenCalled();
    });

    it('resumes a request it was waiting on, issuing no new token', async () => {
      const waiting = {
        name: HookStepName.of('audit'),
        status: 'waiting' as const,
        call: 'call_1',
        until: new Date(NOW.getTime() + 60_000),
      };
      const { steps, requests, issued } = setUp(AUDIT);

      await steps.take(request('audit', { resuming: waiting }));

      expect(requests.resumed).toHaveBeenCalledWith(
        expect.objectContaining({ step: HookStepName.of('audit') }),
        waiting,
        NOW,
      );
      expect(requests.sent).not.toHaveBeenCalled();
      expect(issued).not.toHaveBeenCalled();
    });

    it('resumes a step past the deadline it started within', async () => {
      const waiting = {
        name: HookStepName.of('audit'),
        status: 'waiting' as const,
        call: 'call_1',
        until: new Date(NOW.getTime() + 60_000),
      };
      const { steps, requests } = setUp(AUDIT);

      await steps.take(
        request('audit', {
          resuming: waiting,
          deadline: new Date(NOW.getTime() - 1),
        }),
      );

      expect(requests.resumed).toHaveBeenCalled();
    });

    it('keeps waiting on a call no host has answered yet, until its time is up', async () => {
      const waiting = {
        name: HookStepName.of('audit'),
        status: 'waiting' as const,
        call: 'call_1',
        until: new Date(NOW.getTime() + 60_000),
      };
      const { steps, requests } = setUp(AUDIT);
      requests.resumed.mockResolvedValue(null);

      const result = await steps.take(request('audit', { resuming: waiting }));

      expect(result.outcome).toEqual(waiting);
      expect(requests.unanswered).not.toHaveBeenCalled();
    });

    it('gives up on a call no host answered by the time it waited until', async () => {
      const waiting = {
        name: HookStepName.of('audit'),
        status: 'waiting' as const,
        call: 'call_1',
        until: NOW,
      };
      const { steps, requests } = setUp(AUDIT);
      requests.resumed.mockResolvedValue(null);

      const result = await steps.take(request('audit', { resuming: waiting }));

      expect(result.outcome).toMatchObject({
        status: 'failed',
        code: 'unreachable',
      });
      expect(requests.unanswered).toHaveBeenCalledWith(
        expect.objectContaining({ step: HookStepName.of('audit') }),
        NOW,
      );
    });
  });

  describe('tracing', () => {
    it('records a step’s call on the run of the task', async () => {
      const { steps, record } = setUp(AUDIT);
      const trace = {
        hook: 'grafana-reads',
        step: 'audit',
        kind: 'request' as const,
        target: 'https://audit.example.com/',
        request: {},
        response: null,
        status: 200,
        failed: false,
        startedAt: NOW,
        ms: 3,
      };

      await steps.traced(INSTANCE, {
        ...answered(HookStepName.of('audit')),
        trace,
      });

      expect(record).toHaveBeenCalledWith(
        HookRunAttempt.of(RunId.of('run_1'), 2),
        trace,
      );
    });

    it('records nothing for a task with no run, and survives a trace it cannot record', async () => {
      const { steps, record } = setUp(AUDIT);
      const trace = {
        hook: 'k',
        step: 'audit',
        kind: 'request' as const,
        target: 'x',
        request: {},
        response: null,
        status: 200,
        failed: false,
        startedAt: NOW,
        ms: 1,
      };

      await steps.traced(
        { ...INSTANCE, task: { ...TASK, runId: null }, run: null },
        { ...answered(HookStepName.of('audit')), trace },
      );
      expect(record).not.toHaveBeenCalled();

      record.mockRejectedValueOnce(new Error('db went away'));
      await expect(
        steps.traced(INSTANCE, {
          ...answered(HookStepName.of('audit')),
          trace,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
