import { describe, expect, it } from 'vitest';
import {
  addTask,
  assignTask,
  deleteTask,
  grantAttachmentUpload,
  listRunChangeStacks,
  listTasks,
  listTeamRuns,
  listTeamTraces,
  moveTask,
  readRunConversation,
  readRunMemories,
  readTaskChangeStack,
  readTaskTrace,
  sendMessage,
  stopRun,
} from '@/lib/api';
import { serveMockApi } from '@/mocks/testing';
import { DELIVERY_ID, PLATFORM_ID, SLUG, world } from '@/mocks/world';
import { runsOfTeam } from '@/mocks/world/insights-history';

const teamId = PLATFORM_ID;

describe('the mock work area', () => {
  serveMockApi();

  it('lists every run of the team with its task, newest first', async () => {
    const { data } = await listTeamRuns({
      path: { teamId },
      throwOnError: true,
    });
    const inWorld = world().tasks[teamId].flatMap(
      (task) => world().runs[task.id] ?? [],
    );
    const past = runsOfTeam(teamId).filter(
      (run) => !inWorld.some((each) => each.id === run.runId),
    );
    const ids = new Set(data.map((run) => run.id));

    expect(data).toHaveLength(inWorld.length + past.length);
    expect(inWorld.every((run) => ids.has(run.id))).toBe(true);
    expect(data.every((run) => run.taskTitle)).toBe(true);
    expect(data[0]).toMatchObject({
      id: 'run_retries_3',
      taskId: 'task_retries',
      taskTitle: 'Drain the stuck retry queues',
    });
  });

  it('reads a run conversation with its answer and spend', async () => {
    const { data } = await readRunConversation({
      path: { teamId, runId: 'run_retries_2' },
      throwOnError: true,
    });

    expect(data.station?.name).toBe('Spec');
    expect(data.briefing).toContain('## The task');
    expect(data.notes.map((note) => note.kind)).toEqual(['asked', 'answered']);
    expect(data.notes[1].author?.name).toBe('Maya Chen');
    expect(data.spend?.cost).toBeGreaterThan(0);
  });

  it('reads a failed run with its failure', async () => {
    const { data } = await readRunConversation({
      path: { teamId, runId: 'run_billing_1' },
      throwOnError: true,
    });

    expect(data.notes[0]).toMatchObject({ form: 'failure' });
    expect(data.notes[0].body).toContain('ECONNREFUSED');
  });

  it('lists the change stacks of an implementation run', async () => {
    const { data } = await listRunChangeStacks({
      path: { teamId, runId: 'run_postgres_2' },
      throwOnError: true,
    });

    expect(data.stacks.map((stack) => stack.repository)).toEqual(['acme/api']);
    expect(data.stacks[0]?.files.map((each) => each.path)).toContain(
      'src/db/pool.ts',
    );
  });

  it('reads what a run remembered', async () => {
    const { data } = await readRunMemories({
      path: { teamId, runId: 'run_retries_3' },
      throwOnError: true,
    });

    expect(data.briefed.map((memory) => memory.id)).toEqual([
      'memory_gone',
      'memory_staging',
    ]);
  });

  it('reads the newest change stack of a task', async () => {
    const { data } = await readTaskChangeStack({
      path: { teamId, taskId: 'task_postgres' },
      throwOnError: true,
    });

    expect(data.latest).toMatchObject({ runId: 'run_postgres_2' });
    expect(data.latest?.added).toBeGreaterThan(0);
  });

  it('reads a task trace with one root per run', async () => {
    const { data } = await readTaskTrace({
      path: { teamId, taskId: 'task_retries' },
      throwOnError: true,
    });

    expect(data.roots.map((root) => root.id)).toEqual([
      'run:run_retries_1',
      'run:run_retries_2',
      'run:run_retries_3',
    ]);
    expect(data.faults).toBeGreaterThan(0);
  });

  it('lists the team traces in a range', async () => {
    const { data } = await listTeamTraces({
      path: { teamId },
      query: { range: '30d' },
      throwOnError: true,
    });

    const { data: runs } = await listTeamRuns({
      path: { teamId },
      throwOnError: true,
    });
    const inRange = runs.filter(
      (run) =>
        Date.parse(run.startedAt) >= Date.parse(data.from) &&
        Date.parse(run.startedAt) < Date.parse(data.to),
    );

    expect(data.range).toBe('30d');
    expect(data.traces.map((trace) => trace.taskId)).toContain('task_retries');
    expect(data.volume.reduce((sum, each) => sum + each.count, 0)).toBe(
      inRange.length,
    );
  });

  it('adds, moves, assigns and deletes a task on the board', async () => {
    const { data: grant } = await grantAttachmentUpload({
      path: { slug: SLUG },
      body: { name: 'stack.txt', contentType: 'text/plain', size: 120 },
      throwOnError: true,
    });
    const { data: added } = await addTask({
      path: { teamId, lineId: DELIVERY_ID, stationId: 'station_backlog' },
      body: {
        title: 'Rotate the webhook signing secret',
        attachments: [grant.id],
      },
      throwOnError: true,
    });

    expect(added.attachments.map((each) => each.name)).toEqual(['stack.txt']);

    const { data: moved } = await moveTask({
      path: { teamId, lineId: DELIVERY_ID, taskId: added.id },
      body: { stationId: 'station_triage', revision: added.revision },
      throwOnError: true,
    });

    expect(moved.stationId).toBe('station_triage');
    expect(world().runs[added.id]?.[0]?.state).toBe('queued');

    const { data: assigned } = await assignTask({
      path: { teamId, taskId: added.id },
      body: { assigneeId: 'user_4' },
      throwOnError: true,
    });

    expect(assigned.assignee?.name).toBe('Tom Becker');

    await deleteTask({
      path: { teamId, taskId: added.id },
      throwOnError: true,
    });
    const { data: tasks } = await listTasks({
      path: { teamId },
      throwOnError: true,
    });

    expect(tasks.some((each) => each.id === added.id)).toBe(false);
  });

  it('sends a message to a run and stops it', async () => {
    await sendMessage({
      path: { teamId, runId: 'run_retries_3' },
      body: { body: 'Skip the billing queue entirely.' },
      throwOnError: true,
    });
    const { data: conversation } = await readRunConversation({
      path: { teamId, runId: 'run_retries_3' },
      throwOnError: true,
    });

    expect(conversation.notes.at(-1)).toMatchObject({
      kind: 'message',
      body: 'Skip the billing queue entirely.',
    });

    await stopRun({
      path: { teamId, runId: 'run_retries_3' },
      throwOnError: true,
    });
    const { data: runs } = await listTeamRuns({
      path: { teamId },
      throwOnError: true,
    });

    expect(runs.find((run) => run.id === 'run_retries_3')?.state).toBe(
      'failed',
    );
  });
});

describe('the mock work area in an empty workspace', () => {
  serveMockApi('empty');

  it('answers empty', async () => {
    const { data: runs } = await listTeamRuns({
      path: { teamId },
      throwOnError: true,
    });
    const { data: traces } = await listTeamTraces({
      path: { teamId },
      throwOnError: true,
    });
    const conversation = await readRunConversation({
      path: { teamId, runId: 'run_retries_2' },
    });
    const trace = await readTaskTrace({
      path: { teamId, taskId: 'task_retries' },
    });

    expect(runs).toEqual([]);
    expect(traces.traces).toEqual([]);
    expect(traces.volume.every((each) => each.count === 0)).toBe(true);
    expect(conversation.response?.status).toBe(404);
    expect(trace.response?.status).toBe(404);
  });
});
