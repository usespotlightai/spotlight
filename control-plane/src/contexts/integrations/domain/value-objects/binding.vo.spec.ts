import {
  type BindableEvents,
  Binding,
} from '@integrations/domain/value-objects/binding.vo';
import { describe, expect, it } from 'vitest';

const KNOWN: BindableEvents = {
  task: ['task.asked'],
  chat: ['chat.started'],
  'inbox-request': ['inbox-request.opened'],
  notice: ['notice.raised'],
};

const UNMARKED = { known: KNOWN, marked: false, routed: false };

describe('Binding', () => {
  it('binds an event Spotlight raises to an action', () => {
    const binding = Binding.of({
      event: 'task.asked',
      action: 'post',
      known: KNOWN,
      marked: true,
      routed: true,
    });

    expect(binding.about).toBe('task');
    expect(binding.isFor('task.asked')).toBe(true);
    expect(binding.isFor('task.opened')).toBe(false);
  });

  it('rejects an event Spotlight never raises', () => {
    expect(() =>
      Binding.of({ event: 'task.moved', action: 'post', ...UNMARKED }),
    ).toThrow(
      /must be one of task.asked, chat.started, inbox-request.opened, notice.raised/,
    );
  });

  it.each([
    ['chat.started', 'chat'],
    ['inbox-request.opened', 'inbox-request'],
    ['notice.raised', 'notice'],
  ] as const)('knows a binding on %s is about a %s', (event, subject) => {
    expect(Binding.of({ event, action: 'post', ...UNMARKED }).about).toBe(
      subject,
    );
  });

  it('marks the task and routes by line for an inbox request', () => {
    expect(
      Binding.of({
        event: 'inbox-request.opened',
        action: 'post',
        known: KNOWN,
        marked: true,
        routed: true,
      }).about,
    ).toBe('inbox-request');
  });

  it.each([
    ['chat.started', 'A chat event', { marked: true, routed: false }],
    ['notice.raised', 'A notice event', { marked: false, routed: true }],
  ] as const)(
    'rejects mark and routes on %s, which has no task',
    (event, about, written) => {
      expect(() =>
        Binding.of({ event, action: 'post', known: KNOWN, ...written }),
      ).toThrow(`${about} has no task to mark and no line to route by`);
    },
  );
});
