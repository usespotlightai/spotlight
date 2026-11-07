import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { ChatAccess } from '@work/domain/services/chat-access';
import { describe, expect, it } from 'vitest';

describe('ChatAccess', () => {
  it('lets only the person who started a chat read it', () => {
    expect(
      ChatAccess.readableBy(UserId.of('user_1'), UserId.of('user_1')),
    ).toBe(true);
    expect(
      ChatAccess.readableBy(UserId.of('user_1'), UserId.of('user_2')),
    ).toBe(false);
  });
});
