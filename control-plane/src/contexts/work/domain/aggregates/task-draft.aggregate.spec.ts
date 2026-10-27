import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TaskDraft } from '@work/domain/aggregates/task-draft.aggregate';
import { DraftAlreadySentError } from '@work/domain/exceptions/draft-already-sent.error';
import { InvalidDraftGenerationError } from '@work/domain/exceptions/invalid-draft-generation.error';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { describe, expect, it } from 'vitest';

const taskId = TaskId.of('task_1');

describe('TaskDraft', () => {
  it('opens at the first generation', () => {
    expect(TaskDraft.opened(taskId).generation.value).toBe(0);
  });

  it('moves to the next generation when the generation it shows is sent', () => {
    const sent = TaskDraft.rehydrate({
      taskId,
      generation: DraftGeneration.of(3),
    }).sent(DraftGeneration.of(3));

    expect(sent.generation.value).toBe(4);
    expect(sent.storedGeneration.value).toBe(3);
  });

  it('refuses a send of a generation that was sent already', () => {
    const draft = TaskDraft.rehydrate({
      taskId,
      generation: DraftGeneration.of(4),
    });

    expect(() => draft.sent(DraftGeneration.of(3))).toThrow(
      DraftAlreadySentError,
    );
  });

  it('knows no generation below zero or between whole numbers', () => {
    expect(() => DraftGeneration.of(-1)).toThrow(InvalidDraftGenerationError);
    expect(() => DraftGeneration.of(1.5)).toThrow(InvalidDraftGenerationError);
  });
});
