import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type {
  TracedTask,
  TracedTaskReaderPort,
} from '@work/application/ports/traced-task-reader.port';
import { TracesLoader } from '@work/application/services/traces-loader.service';
import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import { describe, expect, it, vi } from 'vitest';

const tracing = (known: readonly TracedTask[]) => {
  const of = vi.fn(async (ids: readonly TaskId[]) =>
    known.filter((each) => ids.some((id) => id.value === each.taskId)),
  );

  return { of, traces: new TracesLoader({ of } as TracedTaskReaderPort) };
};

const RETRIES = {
  taskId: 'task_1',
  title: 'Retries back off',
  teamId: 'team_1',
};

describe('TracesLoader', () => {
  it('names each task whose trace is shared, once, with the team it is of', async () => {
    const { traces, of } = tracing([RETRIES]);

    const shared = await traces.shared(['task_1', 'task_1']);

    expect(
      shared.map((each) => [
        each.taskId.value,
        each.title.value,
        each.teamId.value,
      ]),
    ).toEqual([['task_1', 'Retries back off', 'team_1']]);
    expect(of).toHaveBeenCalledTimes(1);
  });

  it('shares nothing where nothing was picked', async () => {
    expect(await tracing([]).traces.shared([])).toEqual([]);
  });

  it('knows no task that is not there', async () => {
    await expect(
      tracing([RETRIES]).traces.shared(['task_1', 'task_gone']),
    ).rejects.toThrow(UnknownTaskError);
  });

  it('looks up no more than a message may share', async () => {
    const { traces, of } = tracing([]);

    await expect(
      traces.shared(Array.from({ length: 21 }, (_, at) => `task_${at}`)),
    ).rejects.toThrow(InvalidChatMessageError);
    expect(of).not.toHaveBeenCalled();
  });
});
