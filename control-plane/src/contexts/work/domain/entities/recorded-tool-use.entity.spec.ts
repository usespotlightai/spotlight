import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { RecordedToolUse } from '@work/domain/entities/recorded-tool-use.entity';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { ToolOutput } from '@work/domain/value-objects/tool-output.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-11-07T09:00:00.000Z');

const used = (task: TaskId | null) =>
  RecordedToolUse.of({
    run: { id: RunId.of('run_1'), attempt: 1, task },
    useId: 'use_1',
    tool: Tool.of('linear.comment'),
    inputs: ToolInputs.of({ body: 'Fixed.' }),
    output: ToolOutput.answered('done'),
    failed: false,
    actingAs: null,
    at: AT,
  });

describe('RecordedToolUse', () => {
  it('raises that the tool was used on the run’s task, once the use is first recorded', () => {
    const use = used(TaskId.of('task_1'));

    expect(use?.recordedFirst(true)).toMatchObject({
      kind: 'tool.used',
      useId: 'use_1',
      failed: false,
    });
    expect(use?.recordedFirst(true)?.taskId.value).toBe('task_1');
    expect(use?.recordedFirst(false)).toBeNull();
  });

  it('is no fact for a run that works no task', () => {
    expect(used(null)).toBeNull();
  });
});
