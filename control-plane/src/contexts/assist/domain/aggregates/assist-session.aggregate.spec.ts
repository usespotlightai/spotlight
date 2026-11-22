import { AssistSession } from '@assist/domain/aggregates/assist-session.aggregate';
import { AssistSessionOrdered } from '@assist/domain/events/assist-session-ordered.event';
import { AssistSessionSettled } from '@assist/domain/events/assist-session-settled.event';
import { AssistResultNotAcceptedError } from '@assist/domain/exceptions/assist-result-not-accepted.error';
import { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import { AssistSessionId } from '@assist/domain/value-objects/assist-session-id.vo';
import { AssistSessionKey } from '@assist/domain/value-objects/assist-session-key.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const at = (minute: number) =>
  new Date(`2026-11-21T10:${String(minute).padStart(2, '0')}:00.000Z`);

const USAGE = {
  inputTokens: 1_200,
  outputTokens: 300,
  cost: { amount: 0.42, currency: 'USD' },
};

const SCHEMA = { type: 'object' };

const MODEL = 'claude-code/claude-sonnet-4-5';

const order = () =>
  AssistSession.order({
    id: AssistSessionId.of('assist_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    purpose: AssistPurpose.of('insights.judge'),
    key: AssistSessionKey.of('judging:run_1:1'),
    basedOn: RunId.of('run_1'),
    run: RunId.of('run_2'),
    resultSchema: SCHEMA,
    briefing: 'Judge the run.',
    files: { 'evidence.json': '{}' },
    at: at(0),
  });

const ordered = order();
ordered.pullEvents();

const running = ordered.runQueued({
  harness: 'claude-code',
  model: 'claude-sonnet-4-5',
});

const settledEvents = (session: AssistSession) =>
  session
    .pullEvents()
    .filter(
      (each): each is AssistSessionSettled =>
        each instanceof AssistSessionSettled,
    )
    .map((each) => each.outcome);

describe('AssistSession', () => {
  describe('ordering', () => {
    it('waits from the moment it is ordered, and asks for its run to be queued', () => {
      const session = order();
      const [event] = session.pullEvents();

      expect(session.state).toEqual({ status: 'waiting', since: at(0) });
      expect(session.progress).toEqual({ status: 'ordered' });
      expect(event).toBeInstanceOf(AssistSessionOrdered);
      expect(event).toMatchObject({
        run: RunId.of('run_2'),
        basedOn: RunId.of('run_1'),
        briefing: 'Judge the run.',
        files: { 'evidence.json': '{}' },
      });
    });

    it('takes no result before its run is queued', () => {
      expect(ordered.takesResults).toBe(false);
      expect(() => ordered.submitted({ score: 1 }, at(1))).toThrow(
        new AssistResultNotAcceptedError('ordered'),
      );
    });

    it('names the harness and model its run was queued with', () => {
      expect(running.progress).toEqual({ status: 'running', model: MODEL });
      expect(running.takesResults).toBe(true);
      expect(
        ordered.runQueued({ harness: 'codex', model: null }).progress,
      ).toEqual({ status: 'running', model: 'codex' });
    });

    it('notes its run once', () => {
      expect(running.runQueued({ harness: 'codex', model: null })).toBe(
        running,
      );
    });
  });

  describe('taking a result', () => {
    it('waits with a submitted result until its run has ended', () => {
      const submitted = running.submitted({ score: 0.8 }, at(5));

      expect(submitted.state).toEqual({ status: 'waiting', since: at(0) });
      expect(submitted.runEnded(false, at(6)).state).toEqual({
        status: 'submitted',
        result: { score: 0.8 },
        usage: null,
        model: MODEL,
      });
    });

    it('settles a submitted result with the usage of its run', () => {
      const recorded = running
        .submitted({ score: 0.8 }, at(5))
        .usageRecorded(USAGE);

      expect(recorded.state).toEqual({
        status: 'submitted',
        result: { score: 0.8 },
        usage: USAGE,
        model: MODEL,
      });
    });

    it('takes the usage its run reported before the result', () => {
      const submitted = running
        .usageRecorded(USAGE)
        .submitted({ ok: 1 }, at(5));

      expect(submitted.state).toMatchObject({
        status: 'submitted',
        usage: USAGE,
      });
    });

    it('takes one result only', () => {
      const submitted = running.submitted({ score: 0.8 }, at(5));

      expect(submitted.takesResults).toBe(false);
      expect(() => submitted.submitted({ score: 0.1 }, at(6))).toThrow(
        new AssistResultNotAcceptedError('submitted'),
      );
    });

    it('takes no result once it failed', () => {
      const failed = running.failed('no-result', at(1));

      expect(() => failed.submitted({ score: 0.1 }, at(6))).toThrow(
        new AssistResultNotAcceptedError('failed'),
      );
    });
  });

  describe('failing', () => {
    it('fails when its run ends without a result', () => {
      expect(running.runEnded(false, at(9)).state).toEqual({
        status: 'failed',
        reason: 'no-result',
      });
    });

    it('fails when its run fails before it submits', () => {
      const ended = running.runEnded(true, at(9));

      expect(ended.state).toEqual({ status: 'failed', reason: 'run-failed' });
      expect(ended.settledAt).toEqual(at(9));
    });

    it('fails when its base run is in another workspace', () => {
      expect(ordered.failed('base-run-elsewhere', at(1)).state).toEqual({
        status: 'failed',
        reason: 'base-run-elsewhere',
      });
    });

    it('keeps an accepted result when its run fails afterwards', () => {
      const ended = running
        .submitted({ score: 0.8 }, at(5))
        .runEnded(true, at(9));

      expect(ended.state).toMatchObject({ status: 'submitted' });
      expect(ended.settledAt).toEqual(at(5));
    });

    it('keeps the first reason it failed for', () => {
      const failed = ordered.failed('no-harness', at(1)).runEnded(true, at(9));

      expect(failed.state).toEqual({ status: 'failed', reason: 'no-harness' });
    });

    it('notes only the first end of its run', () => {
      const ended = running.runEnded(false, at(9));

      expect(ended.runEnded(true, at(10))).toBe(ended);
    });
  });

  describe('settling', () => {
    it('says once that its result counts, when the run ends after the result', () => {
      const submitted = running.submitted({ score: 0.8 }, at(5));

      expect(settledEvents(submitted)).toEqual([]);
      expect(
        settledEvents(submitted.runEnded(false, at(6)).usageRecorded(USAGE)),
      ).toEqual(['submitted']);
    });

    it('says its result counts when the run reported its usage first', () => {
      expect(
        settledEvents(running.usageRecorded(USAGE).submitted({ ok: 1 }, at(5))),
      ).toEqual(['submitted']);
    });

    it('says once that it failed', () => {
      expect(
        settledEvents(
          ordered.failed('no-harness', at(1)).runEnded(true, at(2)),
        ),
      ).toEqual(['failed']);
    });

    it('names its workspace, purpose and key', () => {
      const [event] = running.runEnded(true, at(9)).pullEvents();

      expect(event).toMatchObject({
        workspaceId: WorkspaceId.of('ws_1'),
        purpose: AssistPurpose.of('insights.judge'),
        key: AssistSessionKey.of('judging:run_1:1'),
        outcome: 'failed',
      });
    });
  });

  it('refuses a stored session settled while it waits for its run', () => {
    expect(() =>
      AssistSession.rehydrate({
        id: ordered.id,
        workspaceId: ordered.workspaceId,
        purpose: ordered.purpose,
        key: ordered.key,
        basedOn: ordered.basedOn,
        run: ordered.run,
        resultSchema: SCHEMA,
        progress: { status: 'running', model: MODEL },
        usage: null,
        orderedAt: at(0),
        settledAt: at(1),
        runEndedAt: null,
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });
});
