import { RUNS_EVENT_MAPPERS } from '@runs/application/integration-events/runs.event-mappers';
import { orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import { RunCancelled } from '@runs/domain/events/run-cancelled.event';
import { RunEnded } from '@runs/domain/events/run-ended.event';
import { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import { RunUsageRecorded } from '@runs/domain/events/run-usage-recorded.event';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { HandedOverFile } from '@runs/domain/value-objects/handed-over-file.vo';
import { Handover } from '@runs/domain/value-objects/handover.vo';
import { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { Money } from '@runs/domain/value-objects/money.vo';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import { Tokens } from '@runs/domain/value-objects/tokens.vo';
import { ToolUse } from '@runs/domain/value-objects/tool-use.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RECORDED_AT = new Date('2026-10-02T09:30:00.000Z');
const ENDED_AT = new Date('2026-10-02T09:00:00.000Z');

const published = (event: DomainEvent) =>
  RUNS_EVENT_MAPPERS.filter((each) => each.from === event.kind).flatMap(
    (each) => {
      const mapped = each.map(event, RECORDED_AT);

      return mapped ? [mapped] : [];
    },
  );

const WORKSPACE = WorkspaceId.of('ws_1');
const RUN = RunId.of('run_1');
const SUBJECT = orderedFor.holdingTurn('task_1', 0).requester;

describe('RUNS_EVENT_MAPPERS', () => {
  it('publishes the end of a task run, with its report, session and runner', () => {
    expect(
      published(
        new RunEnded(
          RUN,
          WORKSPACE,
          SUBJECT,
          RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
          RunnerId.of('runner_1'),
          Handover.of({
            next: 'review',
            note: 'done',
            attachments: [
              HandedOverFile.of({
                id: 'file_1',
                name: 'shot.png',
                contentType: 'image/png',
                size: 3,
              }),
            ],
          }),
          HarnessSession.of('session_1'),
          RunAttempt.of(RUN, 1),
          false,
          true,
          true,
          ENDED_AT,
        ),
      ),
    ).toEqual([
      {
        kind: 'runs.run-ended.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        requester: {
          owner: 'requester',
          kind: 'subject',
          id: 'task_1',
          token: '0',
          team: 'team_1',
        },
        attempt: 1,
        endedBy: 'turn',
        outcome: 'completed',
        failure: null,
        exitCode: 0,
        message: null,
        stopped: false,
        started: true,
        askedAPerson: false,
        handsOver: true,
        reported: true,
        report: {
          next: 'review',
          note: 'done',
          files: [
            {
              id: 'file_1',
              name: 'shot.png',
              contentType: 'image/png',
              size: 3,
            },
          ],
        },
        session: 'session_1',
        claimedBy: 'runner_1',
        expiredLeases: 0,
        endedAt: ENDED_AT.toISOString(),
      },
    ]);
  });

  it('publishes what a run cost once its usage is recorded, with who asked for it and whether it is listed', () => {
    expect(
      published(
        new RunUsageRecorded(
          RUN,
          WORKSPACE,
          RunRequester.of({
            owner: 'replays',
            kind: 'search',
            id: 'search_1',
            token: '2',
            team: TeamId.of('team_1'),
          }),
          false,
          RunAttempt.of(RUN, 1),
          60_000,
          12,
          1,
          40,
          40_000,
          200_000,
          Money.of(0.42, 'USD'),
          [Money.of(0.42, 'USD'), Money.of(0.1, 'EUR')],
          1,
          Tokens.of({ input: 1_200, output: 900, cacheRead: 80_000 }),
          ToolUse.of({
            servers: [
              {
                server: 'linear',
                calls: 2,
                failed: 1,
                latency: LatencyHistogram.timing([300, 900]),
                lastCallFailed: true,
              },
            ],
            skills: ['our-migrations'],
          }),
        ),
      ),
    ).toEqual([
      {
        kind: 'runs.run-usage-recorded.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        requester: {
          owner: 'replays',
          kind: 'search',
          id: 'search_1',
          token: '2',
          team: 'team_1',
        },
        listed: false,
        ms: 60_000,
        steps: 12,
        errors: 1,
        changedLines: 40,
        contextTokens: 40_000,
        contextWindow: 200_000,
        cost: 0.42,
        currency: 'USD',
        spentCosts: [
          { amount: 0.42, currency: 'USD' },
          { amount: 0.1, currency: 'EUR' },
        ],
        unpricedCalls: 1,
        inputTokens: 1_200,
        outputTokens: 900,
        cacheReadTokens: 80_000,
        cacheWriteTokens: null,
        servers: [
          {
            server: 'linear',
            calls: 2,
            failed: 1,
            latency: LatencyHistogram.timing([300, 900]).counts,
            lastCallFailed: true,
          },
        ],
        skillsRead: ['our-migrations'],
      },
    ]);
  });

  it('publishes the end of a run another requester ordered, with that requester', () => {
    const replay = orderedFor.isolated('run_1').requester;

    expect(
      published(
        new RunEnded(
          RUN,
          WORKSPACE,
          replay,
          RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
          null,
          Handover.of({ next: 'review', note: 'Over to you.' }),
          null,
          RunAttempt.of(RUN, 1),
          true,
          true,
          true,
          ENDED_AT,
        ),
      ),
    ).toEqual([
      {
        kind: 'runs.run-ended.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        requester: {
          owner: 'isolated',
          kind: 'trial',
          id: 'run_1',
          token: null,
          team: 'team_1',
        },
        attempt: 1,
        endedBy: 'turn',
        outcome: 'completed',
        failure: null,
        exitCode: 0,
        message: null,
        stopped: false,
        started: true,
        askedAPerson: true,
        handsOver: true,
        reported: true,
        report: { next: 'review', note: 'Over to you.', files: [] },
        session: null,
        claimedBy: null,
        expiredLeases: 0,
        endedAt: ENDED_AT.toISOString(),
      },
    ]);
    expect(
      published(
        new RunExhausted(
          RUN,
          WORKSPACE,
          replay,
          RunAttempt.of(RUN, 3),
          3,
          false,
          'runner-lost',
          true,
          ENDED_AT,
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        kind: 'runs.run-ended.v1',
        endedBy: 'exhaustion',
        outcome: 'exhausted',
        failure: 'runner-lost',
        askedAPerson: false,
        handsOver: false,
        report: null,
        expiredLeases: 3,
        attempt: 3,
      }),
    ]);
    expect(
      published(
        new RunCancelled(
          RUN,
          WORKSPACE,
          orderedFor.isolated('search_1', undefined, 'isolated', 'search')
            .requester,
          RunAttempt.of(RUN, 2),
          false,
          true,
          ENDED_AT,
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        endedBy: 'cancellation',
        outcome: 'cancelled',
        started: true,
        requester: expect.objectContaining({ kind: 'search', id: 'search_1' }),
      }),
    ]);
    expect(
      published(
        new RunCancelled(
          RUN,
          WORKSPACE,
          orderedFor.spec().requester,
          RunAttempt.of(RUN, 1),
          false,
          false,
          ENDED_AT,
        ),
      ).map((each) => each.kind),
    ).toEqual(['runs.run-ended.v1']);
  });
});
