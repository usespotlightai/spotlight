import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { describe, expect, it } from 'vitest';

const KEY = ContinuityKey.of('task_1-station_1');

describe('Continuity', () => {
  it('takes up no conversation unless given one', () => {
    expect(Continuity.of({ key: KEY }).sessionId).toBeNull();
    expect(
      Continuity.of({ key: KEY, sessionId: HarnessSession.of('session_1') })
        .sessionId?.value,
    ).toBe('session_1');
  });

  it('is the same continuity for the same directory and conversation', () => {
    const resumed = () =>
      Continuity.of({ key: KEY, sessionId: HarnessSession.of('session_1') });

    expect(resumed().equals(resumed())).toBe(true);
    expect(
      Continuity.of({ key: KEY }).equals(Continuity.of({ key: KEY })),
    ).toBe(true);
  });

  it('differs by directory, and by whether and which conversation it takes up', () => {
    const fresh = Continuity.of({ key: KEY });
    const resumed = Continuity.of({
      key: KEY,
      sessionId: HarnessSession.of('session_1'),
    });

    expect(
      fresh.equals(
        Continuity.of({ key: ContinuityKey.of('task_1-station_2') }),
      ),
    ).toBe(false);
    expect(fresh.equals(resumed)).toBe(false);
    expect(resumed.equals(fresh)).toBe(false);
    expect(
      resumed.equals(
        Continuity.of({ key: KEY, sessionId: HarnessSession.of('session_2') }),
      ),
    ).toBe(false);
  });
});
