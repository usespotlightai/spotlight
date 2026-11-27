import { AppGrants } from '@work/domain/value-objects/app-grants.vo';
import { describe, expect, it } from 'vitest';

describe('AppGrants', () => {
  it('says the setup needs to change workflows and set repository variables', () => {
    expect(AppGrants.SETUP_NEEDS).toEqual(['workflows', 'variables']);
  });

  it('names what the setup needs and the App may not do', () => {
    expect(
      AppGrants.of({ workflows: false, variables: false }).missingForSetup(),
    ).toEqual(['workflows', 'variables']);
    expect(
      AppGrants.of({ workflows: true, variables: false }).missingForSetup(),
    ).toEqual(['variables']);
    expect(
      AppGrants.of({ workflows: true, variables: true }).missingForSetup(),
    ).toEqual([]);
  });

  it('lets CI add the workflow only when the App may change workflows', () => {
    expect(AppGrants.of({ workflows: true, variables: false }).workflows).toBe(
      'permitted',
    );
    expect(AppGrants.of({ workflows: false, variables: true }).workflows).toBe(
      'not-permitted',
    );
  });

  it('claims nothing is missing when Spotlight could not read the grants', () => {
    expect(AppGrants.unread().missingForSetup()).toEqual([]);
    expect(AppGrants.unread().lacks('workflows')).toBe(false);
    expect(AppGrants.unread().workflows).toBe('permitted');
  });

  it('equals grants that lack the same', () => {
    expect(
      AppGrants.of({ workflows: false, variables: true }).equals(
        AppGrants.of({ workflows: false, variables: true }),
      ),
    ).toBe(true);
    expect(
      AppGrants.of({ workflows: false, variables: true }).equals(
        AppGrants.unread(),
      ),
    ).toBe(false);
  });
});
