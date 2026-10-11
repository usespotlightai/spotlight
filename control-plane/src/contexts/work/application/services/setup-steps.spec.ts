import { listed, shownFor } from '@work/application/services/setup-steps';
import { SETUP_STEPS, type SetupState } from '@work/domain/services/setup-list';
import { describe, expect, it } from 'vitest';

const nothing: SetupState = {
  connectedToGitHub: false,
  hasHarness: false,
  configured: false,
};

describe('listed', () => {
  it('writes the list out in the order it is worked through', () => {
    const lines = listed().split('\n');

    expect(lines).toHaveLength(SETUP_STEPS.length);
    expect(lines[0]).toBe(
      '1. Install the GitHub App. Connect Spotlight to the repository your team will work with. This lets Spotlight interact with your code through GitHub.',
    );
  });
});

describe('shownFor', () => {
  it('shows the list in the order it is worked through', () => {
    expect(shownFor(nothing).map((each) => each.key)).toEqual([...SETUP_STEPS]);
  });

  it('ticks off what the team has already done', () => {
    const shown = shownFor({ ...nothing, hasHarness: true });

    expect(shown.find((each) => each.key === 'harness')?.done).toBe(true);
    expect(shown.filter((each) => each.done)).toHaveLength(1);
  });
});
