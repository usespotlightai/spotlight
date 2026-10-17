import { forgottenInMemory } from '@outcomes/application/ports/forgotten.fake-spec';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import { NoteRunMemories } from '@outcomes/application/services/note-run-memories.service';
import {
  endOf,
  inTransaction,
  RunRecordsInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');
const TASK = TaskId.of('task_1');

const noting = () => {
  const records = new RunRecordsInMemory();
  const forgotten = forgottenInMemory();
  const service = new NoteRunMemories(
    { endedRun: async () => null } as unknown as WorkPort,
    records,
    forgotten,
    inTransaction,
  );
  const heard = (way: 'briefed' | 'recalled', memories: readonly string[]) =>
    service.used({
      runId: RUN.value,
      workspaceId: WORKSPACE.value,
      taskId: TASK.value,
      way,
      memories,
    });

  return { records, forgotten, heard };
};

describe('NoteRunMemories', () => {
  it('keeps the memories a run was briefed with before it ended, and keeps them when it ends', async () => {
    const { records, heard } = noting();

    await heard('briefed', ['mem_2', 'mem_1']);
    const briefed = await records.of(RUN);
    await records.save(
      (briefed as NonNullable<typeof briefed>).recordEnd(
        endOf({ taskId: 'task_1' }),
      ),
    );
    await heard('recalled', ['mem_1']);

    const ended = await records.of(RUN);

    expect(ended?.hasEnded).toBe(true);
    expect(ended?.memories.briefed).toEqual(['mem_1', 'mem_2']);
    expect(ended?.memories.recalled).toEqual(['mem_1']);
  });

  it('changes nothing when it hears the same memories again, or none', async () => {
    const { records, heard } = noting();

    await heard('briefed', ['mem_1']);
    const first = await records.of(RUN);
    await heard('briefed', ['mem_1']);
    await heard('recalled', []);

    expect((await records.of(RUN))?.version).toBe(first?.version);
    expect((await records.of(RUN))?.memories.recalled).toEqual([]);
  });

  it('keeps nothing for a task that was forgotten, and lets go of what it kept', async () => {
    const { records, forgotten, heard } = noting();

    await heard('briefed', ['mem_1']);
    await forgotten.forgetTask(WORKSPACE, TASK);
    await heard('recalled', ['mem_2']);

    expect(await records.of(RUN)).toBeNull();
    expect(forgotten.locks).toContain(`${WORKSPACE.value} ${TASK.value}`);
  });

  it('keeps nothing for a workspace that was closed', async () => {
    const { records, forgotten, heard } = noting();

    await forgotten.forgetWorkspace(WORKSPACE);
    await heard('briefed', ['mem_1']);

    expect(await records.of(RUN)).toBeNull();
  });
});
