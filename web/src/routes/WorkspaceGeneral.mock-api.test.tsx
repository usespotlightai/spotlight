import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { teamSettingsPath, workspaceGeneralPath } from '@/lib/settings';
import { serveMockApi } from '@/mocks/testing';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

vi.mock('@/lib/avatar-image', () => ({
  avatarUploadOf: () =>
    Promise.resolve({ contentType: 'image/webp', data: 'UklGRg==' }),
}));

const WAIT = { timeout: 5000 };

const IMAGE = new File(['image'], 'logo.png', { type: 'image/png' });

describe('Avatars on the mock API', () => {
  serveMockApi();
  quietBrowser();

  it('uploads the workspace’s avatar and removes it again', async () => {
    render(<MockApplication at={workspaceGeneralPath(SLUG)} />);

    await userEvent.upload(
      await screen.findByLabelText('Avatar image for Acme', undefined, WAIT),
      IMAGE,
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: 'Change the avatar of Acme' }),
        ).toHaveAttribute('aria-haspopup', 'menu'),
      WAIT,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change the avatar of Acme' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Remove' }, WAIT),
    );

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: 'Change the avatar of Acme' }),
        ).not.toHaveAttribute('aria-haspopup'),
      WAIT,
    );
  });

  it('uploads a team’s avatar', async () => {
    render(
      <MockApplication at={teamSettingsPath(SLUG, PLATFORM_ID, 'general')} />,
    );

    await userEvent.upload(
      await screen.findByLabelText(
        'Avatar image for Platform',
        undefined,
        WAIT,
      ),
      IMAGE,
    );

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: 'Change the avatar of Platform' }),
        ).toHaveAttribute('aria-haspopup', 'menu'),
      WAIT,
    );
  });
});
