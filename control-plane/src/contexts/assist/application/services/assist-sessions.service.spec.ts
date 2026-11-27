import type { AssistOrder } from '@assist/application/ports/assist-sessions.port';
import type {
  AssistRunEnqueueing,
  AssistRunOrder,
  RunsPort,
} from '@assist/application/ports/runs.port';
import { AssistSessions } from '@assist/application/services/assist-sessions.service';
import type { AssistSession } from '@assist/domain/aggregates/assist-session.aggregate';
import { AssistSessionOrdered } from '@assist/domain/events/assist-session-ordered.event';
import { AssistSessionSettled } from '@assist/domain/events/assist-session-settled.event';
import { AssistSessionVersionConflictError } from '@assist/domain/exceptions/assist-session-version-conflict.error';
import type { AssistSessionRepository } from '@assist/domain/repositories/assist-session.repository';
import type { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import type { AssistSessionKey } from '@assist/domain/value-objects/assist-session-key.vo';
import { JsonSchemaResultChecks } from '@assist/infrastructure/json/json-schema-result-checks';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');

const ORDER: AssistOrder = {
  workspaceId: 'ws_1',
  purpose: 'insights.judge',
  key: 'judging:run_1:1',
  basedOnRun: 'run_1',
  briefing: 'Read .spotlight/assist/diff.patch and submit a score.',
  files: { 'diff.patch': '+ fixed' },
  resultSchema: {
    type: 'object',
    properties: { score: { type: 'number', minimum: 0, maximum: 1 } },
    required: ['score'],
    additionalProperties: false,
  },
};

const WAITING = { status: 'waiting', since: NOW };

class InMemorySessions implements AssistSessionRepository {
  readonly stored = new Map<string, AssistSession>();
  readonly events: DomainEvent[] = [];
  conflicts = 0;
  raced: 'none' | 'lost' | 'vanished' = 'none';

  findOrdered(
    workspaceId: WorkspaceId,
    purpose: AssistPurpose,
    key: AssistSessionKey,
  ) {
    return Promise.resolve(
      [...this.stored.values()].find(
        (each) =>
          each.workspaceId.equals(workspaceId) &&
          each.purpose.equals(purpose) &&
          each.key.equals(key),
      ) ?? null,
    );
  }

  findByRun(run: RunId) {
    return Promise.resolve(
      [...this.stored.values()].find((each) => each.run.equals(run)) ?? null,
    );
  }

  async add(session: AssistSession) {
    if (this.raced === 'lost') {
      this.raced = 'none';
      await this.add(session.runQueued({ harness: 'codex', model: null }));
      return false;
    }
    if (
      this.raced === 'vanished' ||
      (await this.findOrdered(
        session.workspaceId,
        session.purpose,
        session.key,
      ))
    ) {
      return false;
    }
    this.stored.set(session.id.value, session);
    this.events.push(...session.pullEvents());
    return true;
  }

  save(session: AssistSession) {
    if (this.conflicts > 0) {
      this.conflicts -= 1;
      return Promise.reject(new AssistSessionVersionConflictError());
    }
    this.stored.set(session.id.value, session);
    this.events.push(...session.pullEvents());
    return Promise.resolve();
  }

  ofWorkspace(workspaceId: WorkspaceId) {
    return Promise.resolve(
      [...this.stored.values()].filter((each) =>
        each.workspaceId.equals(workspaceId),
      ),
    );
  }

  remove(session: AssistSession) {
    this.stored.delete(session.id.value);
    return Promise.resolve();
  }
}

const servicing = ({
  enqueueing = {
    outcome: 'enqueued',
    on: { harness: 'claude-code', model: 'claude-sonnet-4-5' },
  },
  leased = true,
}: {
  enqueueing?: AssistRunEnqueueing;
  leased?: boolean;
} = {}) => {
  const sessions = new InMemorySessions();
  const enqueued: AssistRunOrder[] = [];
  const runs: RunsPort = {
    enqueue: (order) => {
      enqueued.push(order);
      return Promise.resolve(enqueueing);
    },
    isLeasedBy: () => Promise.resolve(leased),
  };
  let next = 0;

  const service = new AssistSessions(
    sessions,
    runs,
    new JsonSchemaResultChecks(),
    { generate: () => `id_${(next += 1)}` },
    { now: () => NOW, sleep: () => Promise.resolve() },
  );

  /** Delivers the ordered events the way the outbox hands them to assist's own subscriber. */
  const delivered = async () => {
    for (const event of sessions.events.splice(0)) {
      if (event instanceof AssistSessionOrdered) {
        await service.enqueueRun({
          runId: event.run.value,
          briefing: event.briefing,
          files: event.files,
        });
      }
    }
  };

  const ordered = async (order: AssistOrder = ORDER) => {
    const state = await service.request(order);
    await delivered();
    return state;
  };

  return { service, sessions, enqueued, ordered };
};

const submitted = (result: unknown, runId = 'id_2') => ({
  runId,
  runnerId: 'runner_1',
  result,
});

describe('AssistSessions', () => {
  describe('ordering a session', () => {
    it('adds a waiting session for a key it has not seen, and queues no run itself', async () => {
      const { service, sessions, enqueued } = servicing();

      await expect(service.request(ORDER)).resolves.toEqual(WAITING);
      expect(enqueued).toEqual([]);
      expect(sessions.events).toEqual([
        expect.objectContaining({
          kind: 'assist.session-ordered',
          run: RunId.of('id_2'),
          briefing: ORDER.briefing,
        }),
      ]);
    });

    it('queues the run in reaction to the order, based on the given run', async () => {
      const { enqueued, ordered } = servicing();

      await ordered();

      expect(enqueued).toEqual([
        expect.objectContaining({
          run: RunId.of('id_2'),
          basedOn: RunId.of('run_1'),
          briefing: ORDER.briefing,
          files: ORDER.files,
        }),
      ]);
      expect(enqueued[0]?.purpose.value).toBe('insights.judge');
      expect(enqueued[0]?.session.value).toBe('id_1');
    });

    it('queues one run however often the same key is asked for or the order is delivered', async () => {
      const { service, enqueued, ordered } = servicing();

      await ordered();
      await ordered();
      await service.enqueueRun({ runId: 'id_2', briefing: '', files: {} });

      expect(enqueued).toHaveLength(1);
    });

    it('orders a new session under a new key, and under the same key for another purpose', async () => {
      const { enqueued, ordered } = servicing();

      await ordered();
      await ordered({ ...ORDER, key: 'judging:run_1:2' });
      await ordered({ ...ORDER, purpose: 'insights.pair-judge' });

      expect(enqueued).toHaveLength(3);
    });

    it('refuses a purpose not named after the context that orders it', async () => {
      const { service } = servicing();

      await expect(
        service.request({ ...ORDER, purpose: 'judge' }),
      ).rejects.toThrow('needs a purpose named <context>.<name>');
    });

    it('reports the session another order added first under the same key', async () => {
      const { service, sessions } = servicing();
      sessions.raced = 'lost';

      await expect(service.request(ORDER)).resolves.toEqual(WAITING);
      expect(sessions.stored.size).toBe(1);
    });

    it('calls a refused add without a session under its key an inconsistent state', async () => {
      const { service, sessions } = servicing();
      sessions.raced = 'vanished';

      await expect(service.request(ORDER)).rejects.toBeInstanceOf(
        InconsistentStateError,
      );
    });

    it.each([
      [{ outcome: 'no-harness' }, 'no-harness'],
      [{ outcome: 'base-run-elsewhere' }, 'base-run-elsewhere'],
      [{ outcome: 'refused' }, 'run-failed'],
    ] as const)(
      'fails a session whose run cannot be queued (%o)',
      async (enqueueing, reason) => {
        const { sessions, ordered, service } = servicing({ enqueueing });

        await ordered();

        await expect(service.request(ORDER)).resolves.toEqual({
          status: 'failed',
          reason,
        });
        expect(sessions.events).toEqual([
          expect.objectContaining({
            kind: 'assist.session-settled',
            outcome: 'failed',
          }),
        ]);
      },
    );
  });

  describe('taking a result', () => {
    it('accepts a result that fits the schema it was ordered with', async () => {
      const { service, ordered } = servicing();
      await ordered();

      await expect(service.submit(submitted({ score: 0.8 }))).resolves.toEqual({
        outcome: 'accepted',
      });
    });

    it('reports the result once its run has ended, with its usage and the model it ran', async () => {
      const { service, sessions, ordered } = servicing();
      const usage = {
        inputTokens: 900,
        outputTokens: 100,
        cost: { amount: 0.1, currency: 'USD' },
      };
      await ordered();
      await service.submit(submitted({ score: 0.8 }));

      await expect(service.request(ORDER)).resolves.toEqual(WAITING);

      await service.usageRecorded({ runId: 'id_2', call: usage });
      await service.runEnded({ runId: 'id_2', failed: false, endedAt: NOW });

      await expect(service.request(ORDER)).resolves.toEqual({
        status: 'submitted',
        result: { score: 0.8 },
        usage,
        model: 'claude-code/claude-sonnet-4-5',
      });
      expect(
        sessions.events.filter((each) => each instanceof AssistSessionSettled),
      ).toEqual([expect.objectContaining({ outcome: 'submitted' })]);
    });

    it('names each problem of a result that does not fit, and keeps waiting for one', async () => {
      const { service, ordered } = servicing();
      await ordered();

      const refused = await service.submit(submitted({ score: 2 }));

      expect(refused.outcome).toBe('invalid');
      expect(
        refused.outcome === 'invalid'
          ? refused.problems.map((each) => each.field.rendered)
          : [],
      ).toEqual(['score']);
      await expect(service.submit(submitted({ score: 0.2 }))).resolves.toEqual({
        outcome: 'accepted',
      });
    });

    it('takes no result before its run is queued', async () => {
      const { service } = servicing();
      await service.request(ORDER);

      await expect(service.submit(submitted({ score: 0.8 }))).resolves.toEqual({
        outcome: 'not-accepted',
      });
    });

    it('takes no second result', async () => {
      const { service, ordered } = servicing();
      await ordered();
      await service.submit(submitted({ score: 0.8 }));

      await expect(service.submit(submitted({ score: 0.1 }))).resolves.toEqual({
        outcome: 'not-accepted',
      });
    });

    it('takes no result from a run that is no assist session', async () => {
      const { service, ordered } = servicing();
      await ordered();

      await expect(
        service.submit(submitted({ score: 0.8 }, 'run_9')),
      ).resolves.toEqual({ outcome: 'not-an-assist-run' });
    });

    it('takes no result from a runner that does not lease the run', async () => {
      const { service, ordered } = servicing({ leased: false });
      await ordered();

      await expect(service.submit(submitted({ score: 0.8 }))).resolves.toEqual({
        outcome: 'not-leased',
      });
    });

    it('tries again when the session changed while it took the result', async () => {
      const { service, sessions, ordered } = servicing();
      await ordered();
      sessions.conflicts = 1;

      await expect(service.submit(submitted({ score: 0.8 }))).resolves.toEqual({
        outcome: 'accepted',
      });
    });
  });

  describe('when the run ends', () => {
    it('fails a session whose run ended without a result', async () => {
      const { service, ordered } = servicing();
      await ordered();

      await service.runEnded({ runId: 'id_2', failed: false, endedAt: NOW });

      await expect(service.request(ORDER)).resolves.toEqual({
        status: 'failed',
        reason: 'no-result',
      });
    });

    it('fails a session whose run failed', async () => {
      const { service, ordered } = servicing();
      await ordered();

      await service.runEnded({ runId: 'id_2', failed: true, endedAt: NOW });

      await expect(service.request(ORDER)).resolves.toEqual({
        status: 'failed',
        reason: 'run-failed',
      });
    });

    it('ignores a run that is no assist session', async () => {
      const { service, sessions } = servicing();

      await service.runEnded({ runId: 'run_9', failed: true, endedAt: NOW });

      expect(sessions.stored.size).toBe(0);
    });
  });

  describe('deleting a workspace', () => {
    it('removes the sessions of the deleted workspace and keeps the others', async () => {
      const { service, sessions, ordered } = servicing();
      await ordered();
      await ordered({ ...ORDER, workspaceId: 'ws_2' });

      await service.workspaceDeleted('ws_1');

      expect(
        [...sessions.stored.values()].map((each) => each.workspaceId.value),
      ).toEqual(['ws_2']);
    });

    it('orders a new session under a key the deleted workspace used', async () => {
      const { service, enqueued, ordered } = servicing();
      await ordered();

      await service.workspaceDeleted('ws_1');
      await ordered();

      expect(enqueued).toHaveLength(2);
    });
  });
});
