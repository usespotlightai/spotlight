import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RecordedRunUsage } from '@work/domain/entities/recorded-run-usage.entity';
import { Money } from '@work/domain/value-objects/money.vo';
import { RunRequester } from '@work/domain/value-objects/run-requester.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { describe, expect, it } from 'vitest';

const SEARCH = RunRequester.of({
  owner: 'replays',
  kind: 'search',
  id: 'search_1',
  token: '2',
  team: TeamId.of('team_1'),
});

const recorded = () =>
  RecordedRunUsage.of({
    run: {
      id: RunId.of('run_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      requester: SEARCH,
      listed: false,
      attempt: 2,
    },
    readings: [
      {
        ms: 4_000,
        steps: [{ status: 'failed', change: null }],
        spent: { used: 10, size: 200, cost: Money.of(0.5, 'USD') },
        spentBySession: new Map([
          ['session_1', { used: 10, size: 200, cost: Money.of(0.5, 'USD') }],
        ]),
        tokens: Tokens.of({ input: 7 }),
        calls: [],
      },
    ],
    skillHomes: [],
  });

describe('RecordedRunUsage', () => {
  it('raises one usage event, with who asked for the run and whether it is listed, once the usage is first recorded', () => {
    const event = recorded().recordedFirst(true);

    expect(event).toMatchObject({
      kind: 'run.usage-recorded',
      requester: SEARCH,
      listed: false,
      attempt: 2,
      ms: 4_000,
      steps: 1,
      errors: 1,
      cost: Money.of(0.5, 'USD'),
      spentCosts: [Money.of(0.5, 'USD')],
      unpricedCalls: 0,
      tokens: Tokens.of({ input: 7 }),
    });
    expect(event?.runId.value).toBe('run_1');
  });

  it('raises nothing where the usage of the attempt was recorded before', () => {
    expect(recorded().recordedFirst(false)).toBeNull();
  });
});
