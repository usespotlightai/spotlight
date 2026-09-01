import { HarnessId } from '@domain/value-objects/harness-id.vo';
import {
  BuiltInHarnesses,
  CLAUDE_CODE,
} from '@infrastructure/harnesses/built-in-harnesses';
import { describe, expect, it } from 'vitest';

const known = new BuiltInHarnesses();

describe('the harnesses Spotlight knows', () => {
  it('finds one by the name it is known under', () => {
    expect(known.named(HarnessId.of('claude-code'))).toBe(CLAUDE_CODE);
  });

  it('knows nothing of a harness it was never taught', () => {
    expect(known.named(HarnessId.of('nothing-of-the-sort'))).toBeNull();
  });

  it('holds no two harnesses under one name', () => {
    const named = known.all().map((harness) => harness.id.value);

    expect(new Set(named).size).toBe(named.length);
  });

  // The runner is told what to look for on its PATH, so an entry with no
  // executable is a harness nobody can ever be found to have.
  it('says what to look for on a machine', () => {
    for (const harness of known.all()) {
      expect(harness.command.executable.trim()).not.toBe('');
    }
  });

  it('names every harness for a person to read', () => {
    for (const harness of known.all()) {
      expect(harness.name.value).not.toBe('');
    }
  });
});
