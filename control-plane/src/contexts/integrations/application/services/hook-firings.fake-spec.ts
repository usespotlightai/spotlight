import type { HookCallsPort } from '@integrations/application/ports/hook-calls.port';
import type {
  HookEventInstance,
  HookRuntimePort,
  ListeningHook,
  StepRequest,
  StepResult,
  WrittenStep,
} from '@integrations/application/ports/hook-runtime.port';
import { taskViewOf } from '@integrations/application/ports/tasks-for-hooks.fake-spec';
import type { HookSteps } from '@integrations/application/services/hook-steps.service';
import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import {
  usedTool,
  usingTool,
} from '@integrations/domain/value-objects/hook-event-facts.fake-spec';
import {
  HookEvent,
  type HookEventName,
} from '@integrations/domain/value-objects/hook-event.vo';
import type { HookFailureCode } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookMatch } from '@integrations/domain/value-objects/hook-match.vo';
import { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import { Hook } from '@integrations/domain/value-objects/hook.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { type Mock, type Mocked, vi } from 'vitest';

export const NOW = new Date('2026-09-26T10:00:00.000Z');

export const TASK = taskViewOf();

export const EVENT = usedTool('grafana.search', { inputs: { query: 'cpu' } });

export const USING = usingTool('grafana.search', { query: 'cpu' });

export const later = (ms: number): Date => new Date(NOW.getTime() + ms);

export const hookNamed = (
  key: string,
  steps: string[],
  {
    blocks = false,
    timeoutSeconds = 10,
    on = 'tool.using',
  }: { blocks?: boolean; timeoutSeconds?: number; on?: HookEventName } = {},
): ListeningHook => {
  const event = HookEvent.of(on);

  return {
    id: HookDefinitionId.of(`${key}_id`),
    key: HookKey.of(key),
    teamId: TeamId.of('team_1'),
    blocks,
    compiled: null,
    broken: null,
    written: Hook.of({
      key: HookKey.of(key),
      event,
      match: HookMatch.anything(event),
      steps: steps.map((name) => ({
        name: HookStepName.of(name),
        kind: 'request' as const,
        url: new URL('https://a.example.com'),
        headers: [],
        fromNetwork: false,
      })),
      signing: 'hmac',
      failure: blocks ? 'block' : 'continue',
      timeoutSeconds,
    }),
  };
};

export const brokenHook = (
  key: string,
  blocks: boolean,
  broken = 'when No such key: gone',
): ListeningHook => ({
  ...hookNamed(key, ['check'], { blocks }),
  broken,
  written: null,
});

const stepNamed = (name: HookStepName | string): HookStepName =>
  typeof name === 'string' ? HookStepName.of(name) : name;

export const done = (
  name: HookStepName | string,
  output: unknown = null,
): StepResult => ({
  outcome: { name: stepNamed(name), status: 'done', output },
  denyReason: null,
  trace: {
    hook: 'k',
    step: stepNamed(name).value,
    kind: 'request',
    target: 'https://a.example.com',
    request: {},
    response: output,
    status: 200,
    failed: false,
    startedAt: NOW,
    ms: 3,
  },
});

export const failed = (
  name: HookStepName | string,
  reason = 'was answered 503',
  code: HookFailureCode = 'server-error',
): StepResult => ({
  outcome: {
    name: stepNamed(name),
    status: 'failed',
    code,
    reason,
    output: null,
  },
  denyReason: null,
  trace: null,
});

export const stateOf = (
  firing: HookFiring,
): Parameters<typeof HookFiring.rehydrate>[0] => ({
  id: firing.id,
  hookId: firing.hookId,
  workspaceId: firing.workspaceId,
  teamId: firing.teamId,
  taskId: firing.taskId,
  run: firing.run,
  stationKey: firing.stationKey,
  on: firing.on,
  occurrence: firing.occurrence,
  firedAt: firing.firedAt,
  event: firing.event,
  matched: firing.matched,
  cause: firing.cause,
  link: firing.link,
  steps: firing.steps,
  progress: firing.progress,
  attempts: firing.attempts,
  failure: firing.failure,
  version: firing.version,
});

interface FiringsInMemory {
  readonly firings: Mocked<HookFiringRepository>;
  readonly saved: HookFiring[];
  readonly last: () => HookFiring | undefined;
}

export const firingsInMemory = (
  stored: HookFiring | null = null,
): FiringsInMemory => {
  const byId = new Map<string, HookFiring>(
    stored ? [[stored.id.value, stored]] : [],
  );
  const saved: HookFiring[] = [];
  const firings = {
    add: vi.fn<HookFiringRepository['add']>(
      async (_firing: HookFiring) => true,
    ),
    withId: vi.fn<HookFiringRepository['withId']>(
      async (id: HookFiringId) => byId.get(id.value) ?? null,
    ),
    claimCandidates: vi.fn<HookFiringRepository['claimCandidates']>(
      async (now: Date) =>
        [...byId.values()].filter(
          (each) =>
            each.progress.kind === 'pending' &&
            each.progress.dueAt.getTime() <= now.getTime(),
        ),
    ),
    save: vi.fn<HookFiringRepository['save']>(async (firing: HookFiring) => {
      if (byId.get(firing.id.value)?.version !== firing.version) {
        throw new HookFiringVersionConflictError(firing.id.value);
      }

      const claiming =
        firing.progress.kind === 'working' &&
        byId.get(firing.id.value)?.progress.kind !== 'working';

      if (!claiming) {
        saved.push(firing);
      }
      byId.set(
        firing.id.value,
        HookFiring.rehydrate({
          ...stateOf(firing),
          version: firing.version + 1,
        }),
      );
    }),
    finishedBefore: vi.fn<HookFiringRepository['finishedBefore']>(
      async (_at: Date, _most: number): Promise<readonly HookFiring[]> => [],
    ),
  } satisfies HookFiringRepository;

  return {
    firings,
    saved,
    last: (): HookFiring | undefined => saved[saved.length - 1],
  };
};

export const runtimeOf = (
  hooks: ListeningHook[],
  whenHolds: () => boolean = () => true,
): Mocked<HookRuntimePort> =>
  ({
    listening: vi.fn<HookRuntimePort['listening']>(async () => hooks),
    hook: vi.fn<HookRuntimePort['hook']>(
      async (id: HookDefinitionId) =>
        hooks.find((each) => each.id.equals(id)) ?? null,
    ),
    whenHolds: vi.fn<HookRuntimePort['whenHolds']>(whenHolds),
    written: vi.fn<HookRuntimePort['written']>((): WrittenStep => {
      throw new Error('This test writes out no step.');
    }),
  }) satisfies HookRuntimePort;

export const stepsOf = (
  step: (request: StepRequest) => StepResult,
  calls: HookCallsPort = { record: vi.fn(async () => {}) },
): {
  readonly take: Mock<(request: StepRequest) => Promise<StepResult>>;
  readonly traced: Mock<
    (instance: HookEventInstance, stepResult: StepResult) => Promise<void>
  >;
  readonly steps: HookSteps;
} => {
  const take = vi.fn(
    (request: StepRequest) =>
      new Promise<StepResult>((resolve) => {
        resolve(step(request));
      }),
  );
  const traced = vi.fn(
    async (instance: HookEventInstance, stepResult: StepResult) => {
      if (stepResult.trace && instance.run) {
        await calls.record(instance.run, stepResult.trace);
      }
    },
  );

  return {
    take,
    traced,
    steps: partial<HookSteps>({ take, traced }),
  };
};

export const logger = (): Record<
  'debug' | 'info' | 'warn' | 'error',
  Mock
> => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

export const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
