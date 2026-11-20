import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { HoldRights } from '@work/domain/services/hold-rights';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { describe, expect, it } from 'vitest';

const LEON = UserId.of('user_leon');
const MAYA = UserId.of('user_maya');

describe('HoldRights', () => {
  it('takes turns from people and lets anyone end a hold a person started', () => {
    const hold = { by: LEON, chat: null };

    expect(HoldRights.takesTurns(hold)).toBe(true);
    expect(HoldRights.endableBy(hold, MAYA)).toBe(true);
  });

  it('takes no turns for an agent chat, and lets only its person end it', () => {
    const hold = { by: LEON, chat: ChatId.of('chat_1') };

    expect(HoldRights.takesTurns(hold)).toBe(false);
    expect(HoldRights.endableBy(hold, LEON)).toBe(true);
    expect(HoldRights.endableBy(hold, MAYA)).toBe(false);
  });

  it('lets only a person who acts on the team drive or end a hold', () => {
    const hold = { by: LEON, chat: null };
    const acting = { person: MAYA, actsOnTasks: true };
    const seeing = { person: MAYA, actsOnTasks: false };

    expect(HoldRights.drives(hold, acting)).toBe(true);
    expect(HoldRights.ends(hold, acting)).toBe(true);
    expect(HoldRights.drives(hold, seeing)).toBe(false);
    expect(HoldRights.ends(hold, seeing)).toBe(false);
  });

  it('lets nobody drive an agent chat, and only its person end it', () => {
    const hold = { by: LEON, chat: ChatId.of('chat_1') };

    expect(HoldRights.drives(hold, { person: LEON, actsOnTasks: true })).toBe(
      false,
    );
    expect(HoldRights.ends(hold, { person: LEON, actsOnTasks: true })).toBe(
      true,
    );
    expect(HoldRights.ends(hold, { person: MAYA, actsOnTasks: true })).toBe(
      false,
    );
  });
});
