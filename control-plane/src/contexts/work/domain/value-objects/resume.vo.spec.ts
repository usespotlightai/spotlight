import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import { describe, expect, it } from 'vitest';

const KEY = ResumeKey.of('task-task_1');

describe('Resume', () => {
  it('takes up no conversation unless given one', () => {
    expect(Resume.of({ key: KEY }).sessionId).toBeNull();
    expect(
      Resume.of({ key: KEY, sessionId: HarnessSession.of('session_1') })
        .sessionId?.value,
    ).toBe('session_1');
  });

  it('is the same resume for the same directory and conversation', () => {
    const resumed = () =>
      Resume.of({ key: KEY, sessionId: HarnessSession.of('session_1') });

    expect(resumed().equals(resumed())).toBe(true);
    expect(Resume.of({ key: KEY }).equals(Resume.of({ key: KEY }))).toBe(true);
  });

  it('differs by directory, and by whether and which conversation it takes up', () => {
    const fresh = Resume.of({ key: KEY });
    const resumed = Resume.of({
      key: KEY,
      sessionId: HarnessSession.of('session_1'),
    });

    expect(fresh.equals(Resume.of({ key: ResumeKey.of('task-task_2') }))).toBe(
      false,
    );
    expect(fresh.equals(resumed)).toBe(false);
    expect(resumed.equals(fresh)).toBe(false);
    expect(
      resumed.equals(
        Resume.of({ key: KEY, sessionId: HarnessSession.of('session_2') }),
      ),
    ).toBe(false);
  });
});
