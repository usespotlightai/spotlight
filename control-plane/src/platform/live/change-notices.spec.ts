import {
  ChangeNotices,
  changedFor,
  changedIn,
  messageOfNotice,
  noticing,
} from '@platform/live/change-notices';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { describe, expect, it, vi } from 'vitest';

type Said = DomainEvent & { readonly workspaceId: string; readonly id: string };

const said = (kind: string, id: string): Said => ({
  kind,
  workspaceId: 'ws_1',
  id,
});

const notices = () => {
  const registry = new ChangeNotices();
  registry.register([
    noticing<Said>('test.chat', ['chat.started', 'chat.deleted'], (event) =>
      changedIn(event.workspaceId, 'chat', { chatId: event.id }),
    ),
  ]);
  return registry;
};

describe('ChangeNotices', () => {
  it('gives one notice for each change, however many events say it', () => {
    expect(
      notices().of(
        [
          said('chat.started', 'chat_1'),
          said('chat.deleted', 'chat_1'),
          said('chat.started', 'chat_2'),
          said('task.opened', 'task_1'),
        ],
        vi.fn(),
      ),
    ).toEqual([
      { channel: 'workspace:ws_1', topic: 'chat', ids: { chatId: 'chat_1' } },
      { channel: 'workspace:ws_1', topic: 'chat', ids: { chatId: 'chat_2' } },
    ]);
  });

  it('skips a notice that fails, says so, and keeps the others', () => {
    const registry = notices();
    const failed = vi.fn();
    registry.register([
      noticing<Said>('test.broken', ['chat.started'], () => {
        throw new Error('no workspace');
      }),
    ]);

    expect(registry.of([said('chat.started', 'chat_1')], failed)).toEqual([
      { channel: 'workspace:ws_1', topic: 'chat', ids: { chatId: 'chat_1' } },
    ]);
    expect(failed).toHaveBeenCalledWith('test.broken', expect.any(Error));
  });

  it('refuses two notices of the same name', () => {
    const registry = notices();

    expect(() =>
      registry.register([
        noticing('test.chat', ['chat.started'], () =>
          changedIn('ws_1', 'chat', {}),
        ),
      ]),
    ).toThrow('Two change notices are both called test.chat');
  });

  it('sends a notice as a changed message with its topic and ids', () => {
    expect(
      messageOfNotice(changedFor('user_1', 'chat', { chatId: 'chat_1' })),
    ).toEqual({
      type: 'changed',
      data: { topic: 'chat', ids: { chatId: 'chat_1' } },
    });
  });
});
