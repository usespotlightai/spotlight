import { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { Resume } from '@runs/domain/value-objects/resume.vo';
import { describe, expect, it } from 'vitest';

describe('Resume', () => {
  it('carries on nothing unless it names a conversation', () => {
    expect(Resume.of({}).sessionId).toBeNull();
    expect(
      Resume.of({ sessionId: HarnessSession.of('s_1') }).sessionId?.value,
    ).toBe('s_1');
  });

  it('is the same resume only for the same conversation', () => {
    const one = Resume.of({ sessionId: HarnessSession.of('s_1') });

    expect(one.equals(Resume.of({ sessionId: HarnessSession.of('s_1') }))).toBe(
      true,
    );
    expect(one.equals(Resume.of({ sessionId: HarnessSession.of('s_2') }))).toBe(
      false,
    );
    expect(one.equals(Resume.of({}))).toBe(false);
    expect(Resume.of({}).equals(Resume.of({}))).toBe(true);
  });
});
