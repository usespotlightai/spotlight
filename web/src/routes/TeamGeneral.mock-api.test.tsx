import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addTeamMember } from '@/lib/api';
import { teamSettingsPath } from '@/lib/settings';
import { serveMockApi } from '@/mocks/testing';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

const WAIT = { timeout: 5000 };

const LENA = 'user_5';

const opened = async () => {
  render(
    <MockApplication at={teamSettingsPath(SLUG, PLATFORM_ID, 'general')} />,
  );
  await screen.findByText('Maya Chen', undefined, WAIT);
};

const offered = async (name: RegExp) => {
  await userEvent.click(screen.getByRole('button', { name: 'Add a member' }));
  return screen.findByRole('menuitem', { name }, WAIT);
};

describe('TeamGeneral on the mock API', () => {
  serveMockApi();
  quietBrowser();

  it('offers each workspace member with their address, and lists the one added', async () => {
    await opened();
    const lena = await offered(/^Lena Park/);

    expect(within(lena).getByText('lena.park@acme.dev')).toBeInTheDocument();

    await userEvent.click(lena);

    expect(
      await screen.findByText('Lena Park', undefined, WAIT),
    ).toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: 'Add a member' }),
        ).toBeEnabled(),
      WAIT,
    );
  });

  it('says why someone added meanwhile could not be added, in the server’s words', async () => {
    await opened();
    const lena = await offered(/^Lena Park/);
    await addTeamMember({
      path: { teamId: PLATFORM_ID },
      body: { userId: LENA },
      throwOnError: true,
    });

    await userEvent.click(lena);

    await waitFor(
      () =>
        expect(
          screen
            .getAllByText('Platform already includes this person.')
            .some((each) => each.getAttribute('role') === 'alert'),
        ).toBe(true),
      WAIT,
    );
    expect(
      await screen.findByText('Lena Park', undefined, WAIT),
    ).toBeInTheDocument();
  });
});
