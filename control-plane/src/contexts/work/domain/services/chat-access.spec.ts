import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { ChatAccess } from '@work/domain/services/chat-access';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

const ADA = UserId.of('user_1');
const BEA = UserId.of('user_2');
const SEES = TeamStanding.of({ seesTeam: true, actsOnTeam: false });
const OUTSIDE = TeamStanding.of({ seesTeam: false, actsOnTeam: false });

describe('ChatAccess', () => {
  it('opens a chat only to the person who started it', () => {
    expect(ChatAccess.opensTo(ADA, ADA, SEES)).toBe(true);
    expect(ChatAccess.opensTo(ADA, BEA, SEES)).toBe(false);
  });

  it('keeps a chat closed to its starter once they no longer see its team', () => {
    expect(ChatAccess.opensTo(ADA, ADA, OUTSIDE)).toBe(false);
  });
});
