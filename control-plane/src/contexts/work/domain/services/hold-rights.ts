import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export interface HeldFor {
  readonly by: UserId;
  readonly chat: ChatId | null;
}

export interface HoldViewer {
  readonly person: UserId;
  readonly actsOnTasks: boolean;
}

export const HoldRights = {
  takesTurns(hold: Pick<HeldFor, 'chat'>): boolean {
    return hold.chat === null;
  },

  endableBy(hold: HeldFor, person: UserId): boolean {
    return HoldRights.takesTurns(hold) || hold.by.equals(person);
  },

  drives(hold: Pick<HeldFor, 'chat'>, viewer: HoldViewer): boolean {
    return viewer.actsOnTasks && HoldRights.takesTurns(hold);
  },

  ends(hold: HeldFor, viewer: HoldViewer): boolean {
    return viewer.actsOnTasks && HoldRights.endableBy(hold, viewer.person);
  },
};
