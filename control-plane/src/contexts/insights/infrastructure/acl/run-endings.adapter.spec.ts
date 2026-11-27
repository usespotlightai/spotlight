import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import { RunEndings } from '@insights/infrastructure/acl/run-endings.adapter';
import { describe, expect, it } from 'vitest';

describe('RunEndings', () => {
  const endings = new RunEndings();

  it.each<[RunEnding, string | null, string]>([
    ['failed', 'refused', 'refused'],
    ['failed', 'unprepared', 'setup'],
    ['failed', 'unprovisioned', 'infrastructure'],
    ['exhausted', 'start-gate-unanswered', 'infrastructure'],
    ['exhausted', 'runner-lost', 'infrastructure'],
    ['cancelled', 'cancelled', 'cancelled'],
    ['cancelled', null, 'cancelled'],
  ])(
    'leaves a run that ended %s (%s) out of its station’s signals, as %s',
    (ending, failure, cause) => {
      expect(endings.outsideCauseOf({ ending, failure })).toBe(cause);
    },
  );

  it.each<[RunEnding, string | null]>([
    ['failed', 'exited'],
    ['exhausted', 'timed-out'],
    ['superseded', 'superseded'],
    ['stopped', null],
    ['completed', null],
  ])(
    'keeps a run that ended %s (%s) in its station’s signals',
    (ending, failure) => {
      expect(endings.outsideCauseOf({ ending, failure })).toBeNull();
    },
  );
});
