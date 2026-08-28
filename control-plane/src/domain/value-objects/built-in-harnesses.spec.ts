import {
  harnessNamed,
  BUILT_IN_HARNESSES,
  CLAUDE_CODE,
} from '@domain/value-objects/built-in-harnesses';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { describe, expect, it } from 'vitest';

describe('the harnesses Spotlight knows', () => {
  it('finds one by the name it is known under', () => {
    expect(harnessNamed(HarnessId.of('claude-code'))).toBe(CLAUDE_CODE);
  });

  it('knows nothing of a harness it was never taught', () => {
    expect(harnessNamed(HarnessId.of('nothing-of-the-sort'))).toBeNull();
  });

  it('holds no two harnesses under one name', () => {
    const named = BUILT_IN_HARNESSES.map((harness) => harness.id.value);

    expect(new Set(named).size).toBe(named.length);
  });

  // A station's work is unattended, so a harness that stops to ask hands
  // nothing over and holds its runner until someone notices.
  it('gives every harness what it needs to work unattended', () => {
    for (const harness of BUILT_IN_HARNESSES) {
      expect(harness.command.executable).not.toBe('');
      expect(harness.command.args.length).toBeGreaterThan(0);
    }
  });

  // The runner is told what to look for on its PATH, so an entry with no
  // executable is a harness nobody can ever be found to have.
  it('says what to look for on a machine', () => {
    for (const harness of BUILT_IN_HARNESSES) {
      expect(harness.command.executable.trim()).not.toBe('');
    }
  });

  it('names every harness for a person to read', () => {
    for (const harness of BUILT_IN_HARNESSES) {
      expect(harness.name.value).not.toBe('');
    }
  });
});
