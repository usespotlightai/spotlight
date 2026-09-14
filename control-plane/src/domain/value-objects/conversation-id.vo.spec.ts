import { InvalidConversationIdError } from '@domain/exceptions/invalid-conversation-id.error';
import { ConversationId } from '@domain/value-objects/conversation-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

describe('ConversationId', () => {
  it('names the task and the note it opens with', () => {
    const id = ConversationId.of({ taskId: TaskId.of('task_1'), from: 3 });

    expect(id.value).toBe('task_1:3');
  });

  it('comes back the same after a round trip', () => {
    const id = ConversationId.of({ taskId: TaskId.of('task_1'), from: 3 });

    expect(ConversationId.parse(id.value).equals(id)).toBe(true);
  });

  it('reads the note off the end, whatever the task id holds', () => {
    const id = ConversationId.parse('urn:task:7:2');

    expect(id.taskId.value).toBe('urn:task:7');
    expect(id.from.value).toBe(2);
  });

  it('refuses what does not name a note', () => {
    expect(() => ConversationId.parse('task_1')).toThrow(
      InvalidConversationIdError,
    );
    expect(() => ConversationId.parse('task_1:later')).toThrow(
      InvalidConversationIdError,
    );
    expect(() => ConversationId.parse('task_1:-1')).toThrow(
      InvalidConversationIdError,
    );
    expect(() => ConversationId.parse(':0')).toThrow(
      InvalidConversationIdError,
    );
  });
});
