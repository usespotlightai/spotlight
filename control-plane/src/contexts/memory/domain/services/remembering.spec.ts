import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { NotAllowedAsOfPastTimeError } from '@memory/domain/exceptions/not-allowed-as-of-past-time.error';
import { NotAllowedWithoutMemoriesError } from '@memory/domain/exceptions/not-allowed-without-memories.error';
import {
  type Remembered,
  type RememberedAt,
  Remembering,
} from '@memory/domain/services/remembering';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');

type Step = RememberedAt['steps'][number];

const command = (
  proposes: 'memory' | 'retirement' | null,
  carrying: string | null,
) => ({ proposes, carrying, text: `spotlight … ${carrying ?? '-'}` });

const citing = (step: number, position: number | null) =>
  MemoryProvenance.of({
    taskId: TaskId.of('task_1'),
    runId: RunId.of('run_1'),
    steps: [step],
    notes: [],
    command: position,
  });

const at = (
  change: {
    steps?: readonly Step[];
    cited?: readonly MemoryProvenance[];
    fromOutside?: boolean;
  } = {},
): RememberedAt => ({
  runContext: {
    teamId: TEAM,
    lineId: LineId.of('line_1'),
    stationId: StationId.of('station_1'),
    repositories: [API, WEB],
  },
  steps: change.steps ?? [
    { index: 2, kind: 'message', commands: [] },
    { index: 7, kind: 'remember', commands: [] },
    { index: 9, kind: 'thought', commands: [] },
  ],
  cited: change.cited ?? [],
  fromOutside: change.fromOutside ?? false,
});

const remembered = (change: Partial<Remembered> = {}): Remembered => ({
  kind: 'rationale',
  body: 'Uploads retry in the request, not from a queue.',
  scope: null,
  paths: [],
  supersedes: null,
  ...change,
});

const active = (teamId = TEAM) =>
  Memory.write({
    id: MemoryId.of('memory_old'),
    handle: MemoryHandle.of(7),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'rationale',
    body: MemoryBody.of('Uploads retry from a queue.'),
    scope: MemoryScope.of({ teamId }),
    provenance: null,
    by: MemoryDecision.of({ by: UserId.of('user_1'), at: NOW }),
  });

const proposed = (
  change: Partial<Remembered> = {},
  over?: Parameters<typeof at>[0],
) =>
  Remembering.of({
    taskId: TaskId.of('task_1'),
    runId: RunId.of('run_1'),
    asOf: null,
    isolated: false,
    trial: false,
  }).proposalOf({
    id: MemoryId.of('memory_1'),
    remembered: remembered(change),
    at: at(over),
    now: NOW,
  });

describe('Remembering, what an agent proposes for its team to approve', () => {
  it('is only for a task’s run, sending a chat to the person instead', () => {
    expect(() =>
      Remembering.of({
        taskId: null,
        runId: RunId.of('run_1'),
        asOf: null,
        isolated: false,
        trial: false,
      }),
    ).toThrow(/only from a task's run/);
  });

  it('is never for a run set at a past time, which leaves nothing behind', () => {
    expect(() =>
      Remembering.of({
        taskId: null,
        runId: RunId.of('run_1'),
        asOf: new Date('2026-09-20T00:00:00.000Z'),
        isolated: false,
        trial: false,
      }),
    ).toThrow(NotAllowedAsOfPastTimeError);
  });

  it('is never for an isolated run that is not a trial', () => {
    expect(() =>
      Remembering.of({
        taskId: null,
        runId: RunId.of('run_1'),
        asOf: null,
        isolated: true,
        trial: false,
      }),
    ).toThrow(NotAllowedWithoutMemoriesError);
  });

  it('cites the step the agent remembered it from, as the run’s own', () => {
    const proposal = proposed();

    expect(proposal.provenance.steps).toEqual([7]);
    expect(proposal.provenance.notes).toEqual([]);
    expect(proposal.source).toBe('run');
    expect(proposal.proposed).toBe(true);
  });

  it('cites the latest step not yet remembered from, or the last step', () => {
    expect(
      proposed(
        {},
        {
          steps: [
            { index: 3, kind: 'remember', commands: [] },
            { index: 8, kind: 'remember', commands: [] },
          ],
          cited: [citing(8, null)],
        },
      ).provenance.steps,
    ).toEqual([3]);
    expect(
      proposed({}, { steps: [{ index: 4, kind: 'message', commands: [] }] })
        .provenance.steps,
    ).toEqual([4]);
  });

  describe('choosing the command of its step that made it', () => {
    const BODY = 'Uploads retry in the request, not from a queue.';
    const citationOf = (proposal: {
      provenance: { steps: readonly number[]; command: number | null };
    }) => [proposal.provenance.steps, proposal.provenance.command];

    it('is the command that carried its body, where one step proposed several', () => {
      const step: Step = {
        index: 7,
        kind: 'remember',
        commands: [command('memory', 'npm ci fails.'), command('memory', BODY)],
      };

      expect(citationOf(proposed({}, { steps: [step] }))).toEqual([[7], 1]);
      expect(
        citationOf(
          proposed(
            { body: 'npm ci fails.' },
            { steps: [step], cited: [citing(7, 1)] },
          ),
        ),
      ).toEqual([[7], 0]);
    });

    it('is the one whose body is exactly its own, not one that holds it', () => {
      const step: Step = {
        index: 7,
        kind: 'remember',
        commands: [
          command('memory', `${BODY} Twice.`),
          command('memory', BODY),
        ],
      };

      expect(citationOf(proposed({}, { steps: [step] }))).toEqual([[7], 1]);
    });

    it('cites the same step with its next command for a second proposal of it, not an earlier step', () => {
      const steps: Step[] = [
        { index: 3, kind: 'remember', commands: [command('memory', 'Older.')] },
        {
          index: 7,
          kind: 'remember',
          commands: [command('memory', null), command('memory', null)],
        },
      ];

      expect(citationOf(proposed({}, { steps }))).toEqual([[7], 0]);
      expect(
        citationOf(proposed({}, { steps, cited: [citing(7, 0)] })),
      ).toEqual([[7], 1]);
      expect(
        citationOf(
          proposed({}, { steps, cited: [citing(7, 0), citing(7, 1)] }),
        ),
      ).toEqual([[3], 0]);
    });

    it('takes the latest step whose command carried its body before a later one that carried none inline', () => {
      const steps: Step[] = [
        { index: 3, kind: 'remember', commands: [command('memory', BODY)] },
        { index: 7, kind: 'remember', commands: [command('memory', null)] },
      ];

      expect(citationOf(proposed({}, { steps }))).toEqual([[3], 0]);
      expect(citationOf(proposed({ body: 'From stdin.' }, { steps }))).toEqual([
        [7],
        0,
      ]);
    });

    it('tells a memory from a retirement in one step', () => {
      const steps: Step[] = [
        {
          index: 7,
          kind: 'remember',
          commands: [
            command('retirement', 'Moved to Vitest.'),
            command(null, 'Handed over.'),
            command('memory', BODY),
          ],
        },
      ];
      const remembering = Remembering.of({
        taskId: TaskId.of('task_1'),
        runId: RunId.of('run_1'),
        asOf: null,
        isolated: false,
        trial: false,
      });

      expect(citationOf(proposed({}, { steps }))).toEqual([[7], 2]);
      expect(
        citationOf(
          remembering.retiringOf({
            id: MemoryId.of('memory_2'),
            memory: active(),
            because: ' Moved to Vitest. ',
            at: at({ steps }),
            now: NOW,
          }),
        ),
      ).toEqual([[7], 0]);
    });

    it('cites a remembering step whole where it shows no command of its kind', () => {
      expect(
        citationOf(
          proposed(
            {},
            {
              steps: [
                {
                  index: 7,
                  kind: 'remember',
                  commands: [command('retirement', 'Gone.')],
                },
              ],
            },
          ),
        ),
      ).toEqual([[7], null]);
    });
  });

  it('rejects a memory from a run that has no steps yet', () => {
    expect(() => proposed({}, { steps: [] })).toThrow(InvalidMemoryError);
  });

  it('is from outside when its task is', () => {
    expect(proposed({}, { fromOutside: true }).source).toBe('outside');
  });

  it('applies to the run’s line unless told otherwise', () => {
    expect(proposed().scope).toMatchObject({
      lineId: LineId.of('line_1'),
      stationId: null,
    });
    expect(proposed({ scope: 'station' }).scope).toMatchObject({
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
    });
    expect(proposed({ scope: 'team' }).scope).toMatchObject({
      lineId: null,
      stationId: null,
    });
  });

  it('is about paths inside the repository whose checkout they are in', () => {
    const { scope } = proposed({
      paths: ['api/src/uploads', 'api/src/retry.ts'],
    });

    expect(scope.repository?.value).toBe('acme/api');
    expect(scope.paths.map((each) => each.value)).toEqual([
      'src/uploads',
      'src/retry.ts',
    ]);
    expect(proposed({ paths: ['web'] }).scope).toMatchObject({
      repository: WEB,
      paths: [],
    });
  });

  it('rejects a kind or a scope it does not know, naming the ones it does', () => {
    expect(() => proposed({ kind: 'gossip' })).toThrow(
      /one of rationale, rejected-approach, failure, environment, preference, correction, not gossip/,
    );
    expect(() => proposed({ scope: 'world' })).toThrow(
      /one of team, line, station, not world/,
    );
  });

  it('rejects a path outside the run’s repositories, naming the ones it has', () => {
    expect(() => proposed({ paths: ['docs/readme.md'] })).toThrow(
      /\(api, web\), not docs\/readme\.md/,
    );
    expect(() => proposed({ paths: ['api/../web/src'] })).toThrow(
      InvalidMemoryError,
    );
  });

  it('is about one repository at a time', () => {
    expect(() => proposed({ paths: ['api/src', 'web/src'] })).toThrow(
      /one repository at a time/,
    );
  });

  it('corrects only a memory still active in the run’s team', () => {
    const existing = active();

    expect(
      proposed({ supersedes: existing.asPredecessor }).supersedes?.equals(
        existing.id,
      ),
    ).toBe(true);
    expect(() =>
      proposed({ supersedes: active(TeamId.of('team_other')).asPredecessor }),
    ).toThrow(/M-7 is not one/);
    expect(() =>
      proposed({
        supersedes: existing.retire({
          by: UserId.of('user_1'),
          reason: 'No longer true.',
          at: NOW,
        }).asPredecessor,
      }),
    ).toThrow(/M-7 is not one/);
  });
});
