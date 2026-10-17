import { randomUUID } from 'node:crypto';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { DrizzleBriefedTasks } from '@work/infrastructure/persistence/drizzle/readers/briefed-tasks.reader';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

const NOW = new Date('2026-10-01T09:00:00.000Z');
const STATION = randomUUID();
const RUNNER = RunnerId.of('runner_1');

let database: TestDatabase;
let runs: DrizzleRunRepository;
let briefedTasks: DrizzleBriefedTasks;

beforeAll(async () => {
  database = await openDatabase('run_starting_points');
  runs = new DrizzleRunRepository(new DrizzleContext(database.db), {
    dispatch: async () => {},
  });
  briefedTasks = new DrizzleBriefedTasks(database.db);

  const lineId = randomUUID();
  await database.db.insert(schema.line).values({
    id: lineId,
    key: 'delivery',
    workspaceId: 'ws_1',
    teamId: 'team_1',
    name: 'Delivery',
  });
  await database.db.insert(schema.station).values({
    id: STATION,
    key: 'build',
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

const aTaskRun = (): Run =>
  Run.enqueue({
    id: RunId.of(randomUUID()),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    subject: RunSubject.task(
      TaskId.of(randomUUID()),
      StationId.of(STATION),
      TaskRevision.of(1),
    ),
    spec: RunSpec.of({
      checkouts: [{ remote: 'spotlight:repository', path: 'api' }],
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task-task_1' },
      startingPoint: true,
    }),
    briefedTask: briefed,
  });

describe('a task run’s starting point', () => {
  it('keeps the task as it was briefed, read apart from the run', async () => {
    const run = aTaskRun();
    await runs.add(run, { briefed });

    const found = await runs.findById(run.id);
    const read = await briefedTasks.of(run.id);

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
            ContinuityKey.forTask('task_1'),
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
