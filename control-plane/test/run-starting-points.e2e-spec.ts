import { randomUUID } from 'node:crypto';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { orderedFor } from '@work/domain/aggregates/run.fake-spec';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import type { WorkspaceKey } from '@work/domain/value-objects/workspace-key.vo';
import { DrizzleDispatchRepository } from '@work/infrastructure/persistence/drizzle/repositories/dispatch.repository';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import { aDispatch } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';

const NOW = new Date('2026-10-01T09:00:00.000Z');
const STATION = randomUUID();
const RUNNER = RunnerId.of('runner_1');

let database: TestDatabase;
let runs: DrizzleRunRepository;
let dispatches: DrizzleDispatchRepository;

beforeAll(async () => {
  database = await openDatabase('run_starting_points');
  runs = new DrizzleRunRepository(
    new DrizzleContext(database.db),
    {
      dispatch: async () => {},
    },
    telemetryInMemory(),
  );
  dispatches = new DrizzleDispatchRepository(new DrizzleContext(database.db), {
    dispatch: async () => {},
  });

  const lineId = randomUUID();
  await database.db.insert(schema.line).values({
    id: lineId,
    key: 'delivery',
    workspaceId: 'ws_1',
    teamId: 'team_1',
    name: 'Delivery',
  });
  await insertStations(database.db, {
    id: STATION,
    key: 'build',
    workspaceId: 'ws_1',
    lineId,
    name: 'Build',
    position: 0,
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const SCREENSHOT = Attachment.of({
  id: '5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47',
  name: 'queue-stuck.png',
  contentType: 'image/png',
  size: 2_048,
});

const briefed = BriefedTask.of({
  stationId: StationId.of(STATION),
  title: 'Fix the queue',
  description: 'It stalls on restart.',
  reviewing: Repository.of('acme/api'),
  attachments: [SCREENSHOT],
  notes: [
    {
      station: 'Triage',
      body: 'Reproduced on restart.',
      attachments: [SCREENSHOT],
    },
  ],
  openReviewComments: [
    { at: NotePosition.of(0), place: 'src/queue.ts:12', body: 'Why here?' },
  ],
});

const aTaskRun = (taskId = TaskId.of(randomUUID())): Run =>
  Run.enqueue({
    id: RunId.of(randomUUID()),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    ...orderedFor.task(taskId.value, 1),
    spec: RunSpec.of({
      checkouts: [{ remote: 'spotlight:repository', path: 'api' }],
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      resume: {},
      startingPoint: true,
    }),
  });

describe('a task run’s starting point', () => {
  it('stores the task as it was briefed, read apart from the run', async () => {
    const taskId = TaskId.of(randomUUID());
    const run = aTaskRun(taskId);
    await runs.add(run);
    await database.db.insert(schema.dispatch).values(
      aDispatch({
        runId: run.id.value,
        workspaceId: 'ws_1',
        taskId: taskId.value,
        revision: 1,
        stationId: STATION,
        briefedTask: briefed.parts,
      }),
    );

    const found = await runs.findById(run.id);
    const read = (await dispatches.find(run.id))?.briefedTask;

    expect(read?.equals(briefed)).toBe(true);
    expect(read?.parts).toEqual(briefed.parts);
    expect(found?.spec.value.startingPoint).toBe(true);
    expect(found?.startedFrom).toBeNull();
  });

  it('does not read a run that records only part of where it started', async () => {
    const run = aTaskRun();
    await runs.add(run);
    await database.db
      .update(schema.run)
      .set({ startedFromArchiveId: randomUUID() })
      .where(eq(schema.run.id, run.id.value));

    await expect(runs.findById(run.id)).rejects.toThrow(InconsistentStateError);
  });

  it('reads back where it started, and keeps it as the run goes on', async () => {
    const run = aTaskRun();
    await runs.add(run);

    const claimed = (await runs.findById(run.id))?.claim(RUNNER, NOW) as Run;
    await runs.save(claimed);

    const archive = WorkspaceArchiveId.of(randomUUID());
    const checkouts = [
      StartedCheckout.of({ path: 'api', commit: 'e'.repeat(40) }),
    ];
    await runs.save(
      ((await runs.findById(run.id)) as Run).startsFrom(
        run.currentAttempt,
        RUNNER,
        {
          restored: RestoredArchive.of(
            archive,
            run.workspaceId,
            run.workspaceKey as WorkspaceKey,
          ),
          checkouts,
        },
        NOW,
      ),
    );

    const started = (await runs.findById(run.id)) as Run;
    await runs.save(started.renewLease(RUNNER, new Date(NOW.getTime() + 1)));

    const found = (await runs.findById(run.id)) as Run;

    expect(found.startedFrom?.sameAs({ archive, checkouts })).toBe(true);
    expect(found.startedFrom?.attempt).toBe(1);
    expect(found.startedFrom?.at).toEqual(NOW);
  });
});
