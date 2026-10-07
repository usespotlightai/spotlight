import { Binding } from '@integrations/domain/value-objects/binding.vo';
import { describe, expect, it } from 'vitest';

describe('Binding', () => {
  it('binds an event Spotlight raises to an action', () => {
    const binding = Binding.of({
      event: 'task.asked',
      does: 'post',
      known: ['task.asked'],
    });

    expect(binding.isFor('task.asked')).toBe(true);
    expect(binding.isFor('task.opened')).toBe(false);
  });

  it('refuses an event Spotlight never raises', () => {
    expect(() =>
      Binding.of({ event: 'task.moved', does: 'post', known: ['task.asked'] }),
    ).toThrow(/must be one of task.asked/);
  });
});
