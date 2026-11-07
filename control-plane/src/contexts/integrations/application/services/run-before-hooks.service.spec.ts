import type {
  ListeningHook,
  StepRequest,
  StepResult,
} from '@integrations/application/ports/hook-runtime.port';
import {
  brokenHook,
  clock,
  done,
  failed,
  hookNamed,
  logger,
  NOW,
  runtimeOf,
  stepsOf,
  TASK,
  USING,
} from '@integrations/application/services/hook-firings.fake-spec';
import { RunBeforeHooks } from '@integrations/application/services/run-before-hooks.service';
import { HookDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import { runStarting } from '@integrations/domain/value-objects/hook-event-facts.fake-spec';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import { HookRunAttempt } from '@integrations/domain/value-objects/hook-run-attempt.vo';
import { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ALLOWED = HookDecision.allowed();

const setUp = (
  hooks: ListeningHook[],
  step: (request: StepRequest) => StepResult,
  whenHolds: () => boolean = () => true,
) => {
  const runtime = runtimeOf(hooks, whenHolds);
  const calls = { record: vi.fn(async () => {}) };
  const steps = stepsOf(step, calls);
  let ids = 0;

  return {
    runtime,
    calls,
    take: steps.take,
    before: new RunBeforeHooks(
      runtime,
      steps.steps,
      { generate: () => `id_${++ids}` },
      clock,
      logger(),
      {
        currentOf: async (runId: RunId) => HookRunAttempt.of(runId, 2),
      },
    ),
  };
};

describe('RunBeforeHooks', () => {
  it('allows the event when every step succeeds, tracing each call', async () => {
    const { before, calls } = setUp([hookNamed('audit', ['tell'])], (request) =>
      done(request.step),
    );

    await expect(before.decide(TASK, USING)).resolves.toEqual(ALLOWED);
    expect(calls.record).toHaveBeenCalledWith(
      HookRunAttempt.of(RunId.of('run_1'), 2),
      expect.objectContaining({ step: 'tell' }),
    );
  });

  it('denies when an endpoint says so', async () => {
    const { before } = setUp([hookNamed('dba', ['check'])], () => ({
      ...done('check'),
      denyReason: 'the migration drops a column in use',
    }));

    await expect(before.decide(TASK, USING)).resolves.toEqual(
      HookDecision.denied(
        'Hook dba denied the event. Reason: the migration drops a column in use',
      ),
    );
  });

  it('denies plainly when a blocking hook cannot reach its endpoint', async () => {
    const { before } = setUp(
      [hookNamed('dba', ['check'], { blocks: true })],
      () =>
        failed('check', 'could not reach https://dba.example.com: timed out'),
    );

    await expect(before.decide(TASK, USING)).resolves.toEqual(
      HookDecision.denied(
        'Hook dba failed at step check and blocks on failure. Reason: could not reach https://dba.example.com: timed out',
      ),
    );
  });

  it('treats a step that throws as failed, blocking only when the hook blocks', async () => {
    const throwing = () => {
      throw new Error('the callback token could not be issued');
    };
    const blocking = setUp(
      [hookNamed('dba', ['check'], { blocks: true })],
      throwing,
    );
    const continuing = setUp([hookNamed('audit', ['check'])], throwing);

    await expect(blocking.before.decide(TASK, USING)).resolves.toEqual(
      HookDecision.denied(
        'Hook dba failed at step check and blocks on failure. Reason: the callback token could not be issued',
      ),
    );
    await expect(continuing.before.decide(TASK, USING)).resolves.toEqual(
      ALLOWED,
    );
  });

  it('shares one minute across every hook before an event when no deadline is given', async () => {
    const deadlines: Date[] = [];
    const { before } = setUp(
      [hookNamed('slow', ['tell'], { timeoutSeconds: 30 })],
      (request) => {
        deadlines.push(request.deadline);
        return done('tell');
      },
    );

    await before.decide(TASK, USING);

    expect(deadlines).toEqual([new Date(NOW.getTime() + 30_000)]);
  });

  it('denies when a blocking hook no longer reads as it was written, and skips one that continues', async () => {
    const blocking = setUp([brokenHook('dba', true)], () => done('check'));
    const continuing = setUp([brokenHook('dba', false)], () => done('check'));

    await expect(blocking.before.decide(TASK, USING)).resolves.toEqual(
      HookDecision.denied(
        'Hook dba is broken and blocks on failure. Reason: when No such key: gone',
      ),
    );
    await expect(continuing.before.decide(TASK, USING)).resolves.toEqual(
      ALLOWED,
    );
    expect(continuing.take).not.toHaveBeenCalled();
  });

  it('keeps every hook within the deadline it is given', async () => {
    const deadlines: Date[] = [];
    const { before } = setUp(
      [hookNamed('audit', ['tell'], { on: 'run.starting' })],
      (request) => {
        deadlines.push(request.deadline);
        return done('tell');
      },
    );
    const until = new Date(NOW.getTime() + 3_000);

    await before.decide(TASK, runStarting(), until);

    expect(deadlines).toEqual([until]);
  });

  it('lets the event go on when a hook that continues fails, and stops its later steps', async () => {
    const { before, take } = setUp(
      [hookNamed('audit', ['first', 'second'])],
      () => failed('first'),
    );

    await expect(before.decide(TASK, USING)).resolves.toEqual(ALLOWED);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('skips hooks whose when does not hold', async () => {
    const { before, take } = setUp(
      [hookNamed('audit', ['tell'])],
      () => done('tell'),
      () => false,
    );

    await before.decide(TASK, USING);

    expect(take).not.toHaveBeenCalled();
  });

  it('hands later steps the outputs of earlier ones', async () => {
    const seen: number[] = [];
    const { before } = setUp([hookNamed('audit', ['a', 'b'])], (request) => {
      seen.push(request.earlier.length);
      return done(request.step, 'out');
    });

    await before.decide(TASK, USING);

    expect(seen).toEqual([0, 1]);
  });

  it('runs each step in wait mode, for an occurrence of its own', async () => {
    const requests: StepRequest[] = [];
    const { before } = setUp([hookNamed('audit', ['a'])], (request) => {
      requests.push(request);
      return done('a');
    });

    await before.decide(TASK, USING);

    expect(requests[0]).toMatchObject({
      waitMode: 'wait',
      resuming: null,
      instance: {
        occurrence: HookOccurrenceKey.of('id_1'),
        firing: null,
        event: USING,
      },
    });
  });
});
