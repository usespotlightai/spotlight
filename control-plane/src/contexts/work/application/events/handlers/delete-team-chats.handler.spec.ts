import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { DeleteTeamChats } from '@work/application/events/handlers/delete-team-chats.handler';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('DeleteTeamChats', () => {
  it('removes every chat of the deleted team, each as deleted', async () => {
    const gone = (name: string) => partial<Chat>({ id: ChatId.of(name) });
    const chat = (name: string) =>
      partial<Chat>({ deleted: () => gone(`${name} deleted`) });
    const remove = vi.fn<(chat: Chat) => Promise<void>>(async () => {});
    const ofTeam = vi.fn(async () => [chat('one'), chat('two')]);

    await new DeleteTeamChats(
      partial<ChatRepository>({
        ofTeam,
        remove,
      }),
    ).deleteForTeam(TeamId.of('team_1'));

    expect(ofTeam).toHaveBeenCalledWith(TeamId.of('team_1'));
    expect(remove.mock.calls.map(([each]) => each)).toEqual([
      gone('one deleted'),
      gone('two deleted'),
    ]);
  });
});
