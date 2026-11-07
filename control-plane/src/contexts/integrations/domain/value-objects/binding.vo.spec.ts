import { Binding } from '@integrations/domain/value-objects/binding.vo';
import { describe, expect, it } from 'vitest';

describe('Binding', () => {
  it('binds an event Spotlight raises to an action', () => {
    const binding = Binding.of({
      event: 'task.asked',
      action: 'post',
      known: { task: ['task.asked'], chat: ['chat.started'] },
    });

    expect(binding.about).toBe('task');
    expect(binding.isFor('task.asked')).toBe(true);
    expect(binding.isFor('task.opened')).toBe(false);
  });

  it('rejects an event Spotlight never raises', () => {
    expect(() =>
      Binding.of({
        event: 'task.moved',
        action: 'post',
        known: { task: ['task.asked'], chat: [] },
      }),
    ).toThrow(/must be one of task.asked/);
  });

  it('knows a binding on a chat event is about a chat', () => {
    expect(
      Binding.of({
        event: 'chat.started',
        action: 'post',
        known: { task: ['task.asked'], chat: ['chat.started'] },
      }).about,
    ).toBe('chat');
  });
});
