import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({
    data: [{ fullName: 'acme/api' }, { fullName: 'acme/worker' }],
  }),
}));

describe('FixedRepositories', () => {
  it('opens a read-only menu with the chosen repositories checked', async () => {
    render(
      <FixedRepositories
        slug="acme"
        repositories={['acme/worker']}
        because="A chat keeps the repositories it started with."
      />,
    );

    const selector = screen.getByRole('button', { name: 'Repositories' });
    expect(selector).toBeEnabled();
    expect(selector).toHaveTextContent('acme/worker');
    expect(selector).toHaveAccessibleDescription(
      'A chat keeps the repositories it started with.',
    );

    await userEvent.click(selector);

    const worker = await screen.findByRole('menuitemcheckbox', {
      name: 'acme/worker',
    });
    const api = screen.getByRole('menuitemcheckbox', { name: 'acme/api' });
    expect(worker).toBeChecked();
    expect(worker).toHaveAttribute('aria-disabled', 'true');
    expect(api).not.toBeChecked();
    expect(api).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(api);
    expect(api).not.toBeChecked();
  });
});
