import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SetupAbout } from '@/components/features/onboarding/SetupAbout';

describe('SetupAbout', () => {
  it('shows the description as markdown, as the task page does', () => {
    render(
      <SetupAbout
        title="Set up your team"
        description={'Next:\n\n- connect GitHub\n- add a runner'}
      />,
    );

    const description = screen.getByRole('textbox', { name: 'Description' });

    expect(within(description).getByText('Next:')).toBeVisible();
    expect(
      within(description)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['connect GitHub', 'add a runner']);
  });
});
