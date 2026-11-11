import { RecordRunUsage } from '@runs/application/events/handlers/record-run-usage.handler';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type {
  RunFacts,
  RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import type { RunUsageWriterPort } from '@runs/application/ports/run-usage-writer.port';
import {
  CONVERSATION_POLICY,
  orderedFor,
} from '@runs/domain/aggregates/run.fake-spec';
import type { RecordedRunUsage } from '@runs/domain/entities/recorded-run-usage.entity';
import type { RunEnded } from '@runs/domain/events/run-ended.event';
import type { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import type { RunUsageRecorded } from '@runs/domain/events/run-usage-recorded.event';
import { Money } from '@runs/domain/value-objects/money.vo';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { Tokens } from '@runs/domain/value-objects/tokens.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');

const facts = (over: Partial<RunFacts> = {}): RunFacts =>
  ({
    runId: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    state: 'completed',
    ended: true,
    attempt: 2,
    requester: orderedFor.holdingTurn('task_1', 3).requester.parts,
    policy: orderedFor.holdingTurn('task_1', 3).policy.parts,
    team: TeamId.of('team_1'),
    ...over,
  }) as unknown as RunFacts;

const recording = (found: RunFacts | null) => {
  const recorded: RunUsageRecorded[] = [];
  const known: RunFactsPort = { of: async () => (found ? [found] : []) };
  const usages: RunUsageWriterPort = {
    readingsOf: async () => ({
      attempt: 2,
      readings: [
        {
          handedOver: true,
          ms: 60_000,
          steps: [{ status: 'completed', change: null }],
          spent: { used: 40_000, size: 200_000, cost: Money.of(0.42, 'USD') },
          spentBySession: new Map([
            [
              'session_1',
              { used: 40_000, size: 200_000, cost: Money.of(0.42, 'USD') },
            ],
          ]),
          tokens: Tokens.of({ input: 1_200, output: 900 }),
          calls: [],
        },
      ],
    }),
    record: async (usage: RecordedRunUsage) => {
      const event = usage.recordedFirst(true);
      if (event) {
        recorded.push(event);
      }
    },
  };
  const launch = {
    skillHomes: () => ['.claude/skills'],
  } as unknown as HarnessLaunchPort;

  return {
    handler: new RecordRunUsage(known, usages, launch),
    recorded,
  };
};

const ended = { runId: RUN } as unknown as RunEnded;

describe('RecordRunUsage', () => {
  it('records the usage of a completed run with who asked for it and whether it is listed', async () => {
    const { handler, recorded } = recording(facts());

    await handler.onRunEnded(ended);

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      attempt: RunAttempt.of(RUN, 2),
      listed: true,
      ms: 60_000,
      steps: 1,
      cost: Money.of(0.42, 'USD'),
      spentCosts: [Money.of(0.42, 'USD')],
      unpricedCalls: 0,
    });
    expect(recorded[0]?.requester.subject).toBe('requester/subject/task_1');
    expect(recorded[0]?.requester.token).toBe('3');
  });

  it('records the usage of an exhausted run the same way, for any requester', async () => {
    const { handler, recorded } = recording(
      facts({
        requester: {
          owner: 'replays',
          kind: 'search',
          id: 'search_1',
          token: '1',
          team: 'team_1',
        },
        policy: { ...CONVERSATION_POLICY.parts, listed: false },
      }),
    );

    await handler.onRunExhausted(ended as unknown as RunExhausted);

    expect(recorded[0]?.requester.subject).toBe('replays/search/search_1');
    expect(recorded[0]?.listed).toBe(false);
  });

  it('records nothing for a run that is not ended or not known', async () => {
    const running = recording(facts({ ended: false, state: 'claimed' }));
    const unknown = recording(null);

    await running.handler.onRunEnded(ended);
    await unknown.handler.onRunEnded(ended);

    expect(running.recorded).toEqual([]);
    expect(unknown.recorded).toEqual([]);
  });
});
