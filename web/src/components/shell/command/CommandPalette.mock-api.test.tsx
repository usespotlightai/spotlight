import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inboxPath } from '@/lib/inbox';
import { serveMockApi } from '@/mocks/testing';
import { SLUG } from '@/mocks/world';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

const WAIT = { timeout: 5000 };

const search = async (words: string) => {
  render(<MockApplication at={inboxPath(SLUG)} />);
  await screen.findByRole('link', { name: /Inbox/ }, WAIT);

  fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
  const palette = await screen.findByRole('dialog', { name: 'Search' });
  await userEvent.type(within(palette).getByRole('combobox'), words);

  return palette;
};

describe('the search palette on the mock API', () => {
  serveMockApi();
  quietBrowser();

  it('finds a completed task by its title, under Completed tasks', async () => {
    const palette = await search('disk filling');

    const completed = await within(palette).findByRole(
      'group',
      { name: 'Completed tasks' },
      WAIT,
    );
    expect(
      within(completed).getByRole('option', {
        name: /Worker disk filling up on eu-west-1/,
      }),
    ).toBeInTheDocument();
  });

  it('finds an open task by a word of its description', async () => {
    const palette = await search('saved card');

    const tasks = await within(palette).findByRole(
      'group',
      { name: 'Tasks' },
      WAIT,
    );
    expect(
      within(tasks).getByRole('option', { name: /Flaky checkout test on CI/ }),
    ).toBeInTheDocument();
  });
});
