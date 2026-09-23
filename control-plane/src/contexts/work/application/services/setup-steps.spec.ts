import { listed, shownFor } from '@work/application/services/setup-steps';
import { SETUP_STEPS, type SetupState } from '@work/domain/services/setup-list';
import { describe, expect, it } from 'vitest';

const AT = { slug: 'acme', teamId: 'team_1' };

const nothing: SetupState = {
  hasRunner: false,
  connectedToGitHub: false,
  hasConfiguration: false,
  listensToAnIntegration: false,
};

describe('listed', () => {
  it('writes the list out in the order it is worked through', () => {
    const lines = listed(AT).split('\n');

    expect(lines).toHaveLength(SETUP_STEPS.length);
    expect(lines[0]).toBe(
      '1. [Start a runner](/w/acme/runners). Set up the machine where your team’s work will run. You can connect an existing environment or create a new one.',
    );
  });

  it('leaves a step with nowhere to go as words', () => {
    expect(listed(AT)).toContain('3. Set up your lines.');
  });
});

describe('shownFor', () => {
  it('shows the list in the order it is worked through', () => {
    expect(shownFor(nothing, AT).map((each) => each.key)).toEqual([
      ...SETUP_STEPS,
    ]);
  });

  it('ticks off what the team has already done', () => {
    const shown = shownFor({ ...nothing, hasRunner: true }, AT);

    expect(shown.find((each) => each.key === 'runner')?.done).toBe(true);
    expect(shown.filter((each) => each.done)).toHaveLength(1);
  });

  it('says which page each step is taken from, for this team', () => {
    const shown = shownFor(nothing, AT);

    expect(shown.find((each) => each.key === 'runner')?.where).toBe(
      '/w/acme/runners',
    );
    expect(shown.find((each) => each.key === 'integrations')?.where).toBe(
      '/w/acme/team/team_1/settings/integrations',
    );
    expect(
      shown.find((each) => each.key === 'configuration')?.where,
    ).toBeNull();
  });
});
