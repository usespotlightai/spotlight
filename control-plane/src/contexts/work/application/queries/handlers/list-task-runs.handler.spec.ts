import { firstOf, itemAt } from '@shared-kernel/domain/item-at';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  RunReaderPort,
  TaskRunSummary,
} from '@work/application/ports/run-reader.port';
import { ListTaskRunsHandler } from '@work/application/queries/handlers/list-task-runs.handler';
import { ListTaskRunsQuery } from '@work/application/queries/list-task-runs.query';
import {
  ADMIN_OFF_THE_TEAM,
  audienceOf,
  inWorkspace,
  linesWhere,
  MEMBER,
  OUTSIDE,
  runAccessWhere,
  SEES_ONLY,
} from '@work/application/services/run-access.fake-spec';
import type { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it, vi } from 'vitest';

const summary = (over: Partial<TaskRunSummary> = {}): TaskRunSummary => ({
  id: 'run_1',
  state: 'completed',
  progress: null,
  attempt: 1,
  exitCode: 0,
  startedAt: new Date('2026-08-28T16:32:47.877Z'),
  updatedAt: new Date('2026-08-28T16:33:25.712Z'),
  endedAt: new Date('2026-08-28T16:33:25.712Z'),
  harness: 'claude-code',
  image: null,
  ranOn: null,
  waiting: null,
  station: {
    id: 'station_3',
    name: 'Implementation',
    color: '#edc12b',
    position: 3,
    count: 5,
  },
  review: null,
  audience: audienceOf(),
  driver: 'line',
  ...over,
});

const reading = (found: TaskRunSummary[]) => {
  const listForTask = vi.fn().mockResolvedValue(inWorkspace(found));
  const runs = {
    listForTask,
    listForTeam: vi.fn(),
    findForTeam: vi.fn(),
    notesFor: vi.fn(),
    taskNotesBetween: vi.fn(),
    taskMoves: vi.fn(),
    configFor: vi.fn(),
  } satisfies RunReaderPort;

  return { runs, listForTask };
};

describe('ListTaskRunsHandler', () => {
  it('carries the station a run worked, not the one its task is at now', async () => {
    const { runs } = reading([summary()]);

    const only = firstOf(
      await new ListTaskRunsHandler(
        runs,
        runAccessWhere(true),
        linesWhere(),
      ).execute(new ListTaskRunsQuery('task_1', 'user_1')),
    );

    expect(only?.station).toEqual({
      id: 'station_3',
      name: 'Implementation',
      color: '#edc12b',
      position: 3,
      count: 5,
    });
    expect(only?.harness).toBe('claude-code');
  });

  it('carries the image a run ran in, or none where its runner never said', async () => {
    const pinned = `ghcr.io/acme/widgets@sha256:${'a'.repeat(64)}`;
    const { runs } = reading([summary({ image: pinned }), summary()]);

    const listed = await new ListTaskRunsHandler(
      runs,
      runAccessWhere(true),
      linesWhere(),
    ).execute(new ListTaskRunsQuery('task_1', 'user_1'));
    const ran = firstOf(listed);
    const unreported = itemAt(listed, 1);

    expect(ran?.image).toBe(pinned);
    expect(unreported?.image).toBeNull();
  });

  it('carries the pool a run ran on, and why a queued run waits since when', async () => {
    const { runs } = reading([
      summary({ ranOn: { kind: 'pool', key: 'spotlight', platform: true } }),
      summary({
        state: 'queued',
        waiting: {
          reason: 'no-pool-has-room',
          since: new Date('2026-08-28T16:40:00.000Z'),
        },
      }),
    ]);

    const listed = await new ListTaskRunsHandler(
      runs,
      runAccessWhere(true),
      linesWhere(),
    ).execute(new ListTaskRunsQuery('task_1', 'user_1'));
    const ran = firstOf(listed);
    const queued = itemAt(listed, 1);

    expect(ran?.ranOn).toEqual({
      kind: 'pool',
      key: 'spotlight',
      platform: true,
    });
    expect(ran?.waiting).toBeNull();
    expect(queued?.waiting).toEqual({
      reason: 'no-pool-has-room',
      since: '2026-08-28T16:40:00.000Z',
    });
  });

  it('says whether the line or a person who took the task over drove each run', async () => {
    const { runs } = reading([summary({ driver: 'person' }), summary()]);

    const listed = await new ListTaskRunsHandler(
      runs,
      runAccessWhere(true),
      linesWhere(),
    ).execute(new ListTaskRunsQuery('task_1', 'user_1'));
    const turn = firstOf(listed);
    const line = itemAt(listed, 1);

    expect(turn?.driver).toBe('person');
    expect(line?.driver).toBe('line');
  });

  it('leaves a run dispatched to no station without one', async () => {
    const { runs } = reading([summary({ station: null })]);

    const only = firstOf(
      await new ListTaskRunsHandler(
        runs,
        runAccessWhere(true),
        linesWhere(),
      ).execute(new ListTaskRunsQuery('task_1', 'user_1')),
    );

    expect(only?.station).toBeNull();
  });

  it('requests only the runs of the task the viewer named', async () => {
    const { runs, listForTask } = reading([]);

    await new ListTaskRunsHandler(
      runs,
      runAccessWhere(true),
      linesWhere(),
    ).execute(new ListTaskRunsQuery('task_1', 'user_1'));

    expect(firstOf(listForTask.mock.calls)?.[0]).toMatchObject({
      value: 'task_1',
    });
  });

  it('lists no runs to a viewer who cannot see the workspace of the task', async () => {
    const { runs } = reading([summary()]);

    expect(
      await new ListTaskRunsHandler(
        runs,
        runAccessWhere(false),
        linesWhere(),
      ).execute(new ListTaskRunsQuery('task_1', 'user_1')),
    ).toEqual([]);
  });

  it('carries the times as ISO strings', async () => {
    const { runs } = reading([summary()]);

    const found = firstOf(
      await new ListTaskRunsHandler(
        runs,
        runAccessWhere(true),
        linesWhere(),
      ).execute(new ListTaskRunsQuery('task_1', 'user_1')),
    );

    expect(found?.startedAt).toBe('2026-08-28T16:32:47.877Z');
    expect(found?.updatedAt).toBe('2026-08-28T16:33:25.712Z');
  });

  it('keeps a missing exit code missing', async () => {
    const { runs } = reading([summary({ state: 'queued', exitCode: null })]);

    const found = firstOf(
      await new ListTaskRunsHandler(
        runs,
        runAccessWhere(true),
        linesWhere(),
      ).execute(new ListTaskRunsQuery('task_1', 'user_1')),
    );

    expect(found?.exitCode).toBeNull();
  });

  it('carries that the answer for a run is still pending, and where it is answered', async () => {
    const { runs } = reading([
      summary({ review: { state: 'pending', conversationId: 'task_1:5' } }),
    ]);

    const found = firstOf(
      await new ListTaskRunsHandler(
        runs,
        runAccessWhere(true),
        linesWhere(),
      ).execute(new ListTaskRunsQuery('task_1', 'user_1')),
    );

    expect(found?.review).toEqual({
      state: 'pending',
      conversationId: 'task_1:5',
    });
  });

  it('passes on the progress the reader gives each run', async () => {
    const { runs } = reading([
      summary({ id: 'run_1', state: 'claimed', progress: 'stopping' }),
      summary({ id: 'run_2', state: 'suspended', progress: null }),
    ]);

    const found = await new ListTaskRunsHandler(
      runs,
      runAccessWhere(true),
      linesWhere(),
    ).execute(new ListTaskRunsQuery('task_1', 'user_1'));

    expect(found.map((each) => each.progress)).toEqual(['stopping', null]);
  });

  describe('waiting for you', () => {
    const ALICE = UserId.of('user_alice');
    const BOB = UserId.of('user_bob');
    const waiting = (
      assignee: string | null,
      ask: {
        approval: { open: boolean; askedOf: UserId | null };
      } | null = null,
    ) =>
      summary({
        state: 'suspended',
        audience: audienceOf({
          waits: true,
          task: {
            running: true,
            pending: {
              assignee: nonEmpty(assignee) ? UserId.of(assignee) : null,
              ask: ask && { ...ask, connectionAsk: null },
            },
          },
          to: { currentRun: true, atTaskStation: true },
        }),
      });
    const seenBy = async (
      run: ReturnType<typeof summary>,
      viewer: string,
      standing: TeamStanding = MEMBER,
    ) => {
      const { runs } = reading([run]);
      const found = firstOf(
        await new ListTaskRunsHandler(
          runs,
          runAccessWhere(true, standing),
          linesWhere(),
        ).execute(new ListTaskRunsQuery('task_1', viewer)),
      );

      return {
        waitingForYou: found?.waitingForYou,
        yourMessage: found?.yourMessage,
      };
    };

    it('waits for Alice, who is the assignee, and refuses a message from Bob', async () => {
      await expect(
        seenBy(waiting('user_alice'), 'user_alice'),
      ).resolves.toEqual({ waitingForYou: true, yourMessage: 'answer' });
      await expect(seenBy(waiting('user_alice'), 'user_bob')).resolves.toEqual({
        waitingForYou: false,
        yourMessage: 'awaits-another',
      });
    });

    it('waits for a member while the task has no assignee, but not for an admin off the team', async () => {
      await expect(seenBy(waiting(null), 'user_bob')).resolves.toEqual({
        waitingForYou: true,
        yourMessage: 'answer',
      });
      await expect(
        seenBy(waiting(null), 'user_admin', ADMIN_OFF_THE_TEAM),
      ).resolves.toEqual({
        waitingForYou: false,
        yourMessage: 'awaits-another',
      });
    });

    it('waits for nobody who does not act on the team, and refuses their message', async () => {
      for (const standing of [SEES_ONLY, OUTSIDE]) {
        await expect(
          seenBy(waiting(null), 'user_bob', standing),
        ).resolves.toEqual({ waitingForYou: false, yourMessage: 'not-acting' });
        await expect(
          seenBy(waiting('user_alice'), 'user_alice', standing),
        ).resolves.toEqual({ waitingForYou: false, yourMessage: 'not-acting' });
      }
    });

    it('waits for nobody while the run waits for no person, and refuses a message to a run at a station the task has left', async () => {
      await expect(seenBy(summary(), 'user_alice')).resolves.toEqual({
        waitingForYou: false,
        yourMessage: 'moved-on',
      });
    });

    it('waits for Bob when an approval asks him on Alice’s task, and puts the task on hold on a message from either', async () => {
      const asked = waiting('user_alice', {
        approval: { open: true, askedOf: BOB },
      });

      await expect(seenBy(asked, 'user_bob')).resolves.toEqual({
        waitingForYou: true,
        yourMessage: 'holds',
      });
      await expect(seenBy(asked, 'user_alice')).resolves.toEqual({
        waitingForYou: true,
        yourMessage: 'holds',
      });
    });

    it('waits for an admin off the team when an approval asks them by name, and refuses their message, which would hold the task', async () => {
      await expect(
        seenBy(
          waiting(null, { approval: { open: true, askedOf: ALICE } }),
          'user_alice',
          ADMIN_OFF_THE_TEAM,
        ),
      ).resolves.toEqual({ waitingForYou: true, yourMessage: 'not-on-team' });
    });

    it('puts the task on hold on a member’s message to its station, and refuses an admin off the team', async () => {
      const ended = summary({
        audience: audienceOf({ to: { atTaskStation: true } }),
      });

      await expect(seenBy(ended, 'user_bob')).resolves.toEqual({
        waitingForYou: false,
        yourMessage: 'holds',
      });
      await expect(
        seenBy(ended, 'user_admin', ADMIN_OFF_THE_TEAM),
      ).resolves.toEqual({ waitingForYou: false, yourMessage: 'not-on-team' });
    });

    it('takes a message as a message where the task’s station has no harness', async () => {
      const { runs } = reading([
        summary({ audience: audienceOf({ to: { atTaskStation: true } }) }),
      ]);
      const found = firstOf(
        await new ListTaskRunsHandler(
          runs,
          runAccessWhere(true, ADMIN_OFF_THE_TEAM),
          linesWhere([]),
        ).execute(new ListTaskRunsQuery('task_1', 'user_admin')),
      );

      expect(found?.yourMessage).toBe('message');
    });

    it('answers a question no run asked with a message to a run at the task’s station, though that run waits for nobody', async () => {
      const asked = (assignee: string | null) =>
        summary({
          audience: audienceOf({
            task: {
              pending: {
                assignee: nonEmpty(assignee) ? UserId.of(assignee) : null,
                ask: null,
              },
            },
            to: { atTaskStation: true },
          }),
        });

      await expect(seenBy(asked(null), 'user_bob')).resolves.toEqual({
        waitingForYou: false,
        yourMessage: 'answer',
      });
      await expect(seenBy(asked('user_alice'), 'user_bob')).resolves.toEqual({
        waitingForYou: false,
        yourMessage: 'awaits-another',
      });
    });

    it('waits for nobody who only sees the team, even when an approval asks them by name', async () => {
      await expect(
        seenBy(
          waiting(null, { approval: { open: true, askedOf: ALICE } }),
          'user_alice',
          SEES_ONLY,
        ),
      ).resolves.toEqual({ waitingForYou: false, yourMessage: 'not-acting' });
    });
  });

  describe('stopping', () => {
    const working = (over: Partial<TaskRunSummary> = {}) =>
      summary({ state: 'claimed', progress: 'in-progress', ...over });
    const stoppableBy = async (
      run: TaskRunSummary,
      viewer: string,
      standing: TeamStanding = MEMBER,
    ) => {
      const { runs } = reading([run]);
      const found = firstOf(
        await new ListTaskRunsHandler(
          runs,
          runAccessWhere(true, standing),
          linesWhere(),
        ).execute(new ListTaskRunsQuery('task_1', viewer)),
      );

      return found?.stoppableByYou;
    };

    it('lets Alice, who is the assignee, Bob and an admin off the team stop a run in progress', async () => {
      await expect(stoppableBy(working(), 'user_alice')).resolves.toBe(true);
      await expect(stoppableBy(working(), 'user_bob')).resolves.toBe(true);
      await expect(
        stoppableBy(working(), 'user_admin', ADMIN_OFF_THE_TEAM),
      ).resolves.toBe(true);
    });

    it('lets nobody stop a run when they only see the team', async () => {
      await expect(
        stoppableBy(working(), 'user_reader', SEES_ONLY),
      ).resolves.toBe(false);
    });

    it('lets nobody stop a run that ran at no station', async () => {
      await expect(
        stoppableBy(
          working({
            audience: {
              ...audienceOf(),
              run: { ...audienceOf().run, stationId: null },
            },
          }),
          'user_alice',
        ),
      ).resolves.toBe(false);
    });
  });

  it('answers with nothing for a task the viewer cannot see', async () => {
    const { runs } = reading([]);

    await expect(
      new ListTaskRunsHandler(runs, runAccessWhere(true), linesWhere()).execute(
        new ListTaskRunsQuery('task_1', 'stranger'),
      ),
    ).resolves.toEqual([]);
  });
});
