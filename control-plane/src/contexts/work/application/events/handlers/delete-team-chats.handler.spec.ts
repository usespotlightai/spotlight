import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { DeleteTeamChats } from '@work/application/events/handlers/delete-team-chats.handler';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { describe, expect, it, vi } from 'vitest';

describe('DeleteTeamChats', () => {
  it('removes every chat of the deleted team, each as deleted', async () => {
    const gone = (name: string) => ({ name }) as unknown as Chat;
    const chat = (name: string) =>
      ({ deleted: () => gone(`${name} deleted`) }) as unknown as Chat;
    const remove = vi.fn<(chat: Chat) => Promise<void>>(async () => {});
    const ofTeam = vi.fn(async () => [chat('one'), chat('two')]);

    await new DeleteTeamChats({
      ofTeam,
      remove,
    } as unknown as ChatRepository).deleteForTeam(TeamId.of('team_1'));

    expect(ofTeam).toHaveBeenCalledWith(TeamId.of('team_1'));
    expect(remove.mock.calls.map(([each]) => each)).toEqual([
      gone('one deleted'),
      gone('two deleted'),
    ]);
  });
});
