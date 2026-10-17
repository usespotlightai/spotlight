import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { UnreplayableRunError } from '@work/domain/exceptions/unreplayable-run.error';
import { replayPlanFor } from '@work/domain/services/replay-plan';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import { StartingPoint } from '@work/domain/value-objects/starting-point.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { describe, expect, it } from 'vitest';

const REPLAYED_AS = StationConfig.rehydrate(
  {
    prompt: null,
    harness: 'dev',
    model: null,
    effort: null,
    profile: null,
    image: null,
    repositories: [],
    skills: [],
    tools: [],
    decisions: false,
    memories: false,
  },
  'f'.repeat(64),
);

const NOW = new Date('2026-10-01T09:00:00.000Z');
const BUILD = StationId.of('station_build');
const API = 'a'.repeat(40);
const REPLAY_ID = RunId.of('run_2');

const laidOut = (worked: StationId, key: string, ends = false) => [
  Station.of({
    id: StationId.of(`${key}_backlog`),
    key: StationKey.of('backlog'),
    name: StationName.of('Backlog'),
    position: 0,
    color: StationColor.plain(),
    kind: 'backlog',
  }),
  Station.of({
    id: worked,
    key: StationKey.of(key),
    name: StationName.of(key),
    position: 1,
    color: StationColor.plain(),
    harness: HarnessId.of('dev'),
    wayOut: WayOut.of({ ends }),
  }),
  Station.of({
    id: StationId.of(`${key}_completed`),
    key: StationKey.of('completed'),
    name: StationName.of('Completed'),
    position: 2,
    color: StationColor.plain(),
    kind: 'completed',
  }),
];

const line = (
  repositories: readonly string[] = ['acme/api', 'acme/web'],
  ends = false,
) =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    repositories: repositories.map((each) =>
      WorkedRepository.of(Repository.of(each), {
        setup: each === 'acme/api' ? RepositorySetup.of('npm ci') : null,
      }),
    ),
    stations: laidOut(BUILD, 'build', ends),
  });

const briefed = (reviewing: string | null = null) =>
  BriefedTask.of({
    stationId: BUILD,
    title: 'Fix the queue',
    description: null,
    reviewing: reviewing ? Repository.of(reviewing) : null,
    attachments: [],
    notes: [],
    openRemarks: [],
  });

const original = (
  over: {
    subject?: RunSubject;
    startedFrom?: StartingPoint | null;
    state?: 'completed' | 'claimed';
  } = {},
) =>
  Run.rehydrate({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    priority: RunPriority.normal,
    configuredAs: over.subject?.isReplay ? REPLAYED_AS : null,
    subject:
      over.subject ??
      RunSubject.task(TaskId.of('task_1'), BUILD, TaskRevision.of(1)),
    spec: RunSpec.of({
      checkouts: [
        {
          remote: 'spotlight:repository',
          path: 'api',
          ...(over.subject?.isReplay ? { ref: API } : {}),
        },
      ],
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task-task_1' },
      ...(over.subject?.isReplay
        ? {
            replay: {
              archive: null,
              checkouts: [{ path: 'api', commit: API, repository: 'acme/api' }],
              movesOnAfter: [],
            },
          }
        : {}),
    }),
    state: over.state ?? 'completed',
    claimedBy: over.state === 'claimed' ? RunnerId.of('runner_1') : null,
    leaseExpiresAt: over.state === 'claimed' ? NOW : null,
    outcome: null,
    attempt: 1,
    reservation: null,
    provisioning: Provisioning.none(),
    startedFrom:
      over.startedFrom === undefined
        ? StartingPoint.of({
            archive: WorkspaceArchiveId.of('archive_1'),
            checkouts: [StartedCheckout.of({ path: 'api', commit: API })],
            attempt: 1,
            at: NOW,
          })
        : over.startedFrom,
  });

const unreplayableReasonOf = (plan: () => unknown) => {
  try {
    plan();
  } catch (error) {
    if (error instanceof UnreplayableRunError) {
      return error.unreplayableReason;
    }
    throw error;
  }
  throw new Error('the replay was planned');
};

describe('planning a replay', () => {
  it('replays the run’s task at its station, from the archive and commits it started at, in a workspace of its own', () => {
    const plan = replayPlanFor({
      original: original(),
      briefed: briefed(),
      candidate: line(),
      id: REPLAY_ID,
    });

    expect(plan.subject.replayOf?.value).toBe('run_1');
    expect(plan.subject.replayedTaskId?.value).toBe('task_1');
    expect(plan.subject.taskId).toBeNull();
    expect(plan.at.stationId.equals(BUILD)).toBe(true);
    expect(plan.at.continuity.key.value).toBe('replay-run_2');
    expect(plan.at.continuity.sessionId).toBeNull();
    expect(plan.archive?.value).toBe('archive_1');
    expect(plan.replay).toEqual({
      archive: 'archive_1',
      checkouts: [{ path: 'api', commit: API, repository: 'acme/api' }],
      movesOnAfter: [],
    });
    expect(plan.at.checkouts).toEqual([
      {
        repository: Repository.of('acme/api'),
        branch: null,
        ref: API,
        diffOf: 'worktree',
        setup: RepositorySetup.of('npm ci'),
      },
    ]);
  });

  it('diffs a reviewed repository by its commits, as its original did', () => {
    const plan = replayPlanFor({
      original: original(),
      briefed: briefed('acme/api'),
      candidate: line([]),
      id: REPLAY_ID,
    });

    expect(plan.at.checkouts[0]?.diffOf).toBe('commits');
    expect(plan.at.checkouts[0]?.repository.value).toBe('acme/api');
  });

  it('rejects a run that worked no task, says so, and rejects a replay of a replay', () => {
    for (const subject of [
      RunSubject.chat(ChatId.of('chat_1')),
      RunSubject.replay(
        RunId.of('run_0'),
        TaskId.of('task_1'),
        BUILD,
        TeamId.of('team_1'),
      ),
    ]) {
      expect(
        unreplayableReasonOf(() =>
          replayPlanFor({
            original: original({ subject, startedFrom: null }),
            briefed: briefed(),
            candidate: line(),
            id: REPLAY_ID,
          }),
        ),
      ).toBe('not-a-task-run');
    }
  });

  it('records the words after which the candidate moves the work on without a person, by the rule task runs follow', () => {
    const plan = replayPlanFor({
      original: original(),
      briefed: briefed(),
      candidate: line(['acme/api'], true),
      id: REPLAY_ID,
    });

    expect(plan.replay.movesOnAfter).toEqual(['done']);
  });

  it('rejects a run that has not ended', () => {
    expect(
      unreplayableReasonOf(() =>
        replayPlanFor({
          original: original({ state: 'claimed' }),
          briefed: briefed(),
          candidate: line(),
          id: REPLAY_ID,
        }),
      ),
    ).toBe('still-running');
  });

  it('rejects a run that never said where it started', () => {
    expect(
      unreplayableReasonOf(() =>
        replayPlanFor({
          original: original({ startedFrom: null }),
          briefed: briefed(),
          candidate: line(),
          id: REPLAY_ID,
        }),
      ),
    ).toBe('no-starting-point');
  });

  it('rejects a run whose briefing was never kept', () => {
    expect(
      unreplayableReasonOf(() =>
        replayPlanFor({
          original: original(),
          briefed: null,
          candidate: line(),
          id: REPLAY_ID,
        }),
      ),
    ).toBe('no-briefing');
  });

  it('rejects a candidate line without the station the run worked at', () => {
    const elsewhere = Line.rehydrate({
      id: LineId.of('line_2'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('other'),
      name: LineName.of('Other'),
      stations: laidOut(StationId.of('station_other'), 'other'),
    });

    expect(
      unreplayableReasonOf(() =>
        replayPlanFor({
          original: original(),
          briefed: briefed(),
          candidate: elsewhere,
          id: REPLAY_ID,
        }),
      ),
    ).toBe('not-at-the-station');
  });

  it('rejects a run that checked out a repository the line no longer works', () => {
    expect(
      unreplayableReasonOf(() =>
        replayPlanFor({
          original: original(),
          briefed: briefed(),
          candidate: line(['acme/web']),
          id: REPLAY_ID,
        }),
      ),
    ).toBe('repository-gone');
  });
});
