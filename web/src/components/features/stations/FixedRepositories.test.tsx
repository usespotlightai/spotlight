import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({
    data: [{ fullName: 'acme/api' }, { fullName: 'acme/worker' }],
  }),
}));

const because = 'A chat keeps the repositories it started with.';

describe('FixedRepositories', () => {
  it('opens a read-only menu with only the chosen repositories', async () => {
    render(
      <FixedRepositories
        slug="acme"
        repositories={['acme/worker']}
        because={because}
      />,
    );

    const selector = screen.getByRole('button', { name: 'Repositories' });
    expect(selector).toBeEnabled();
    expect(selector).toHaveTextContent('acme/worker');
    expect(selector).toHaveAccessibleDescription(because);

    await userEvent.click(selector);

    const worker = await screen.findByRole('menuitemcheckbox', {
      name: 'acme/worker',
    });
    expect(worker).toBeChecked();
    expect(worker).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.queryByRole('menuitemcheckbox', { name: 'acme/api' }),
    ).not.toBeInTheDocument();

    expect(screen.getAllByText(because)).toHaveLength(1);
    await userEvent.hover(worker.parentElement as HTMLElement);
    await waitFor(() => expect(screen.getAllByText(because)).toHaveLength(2));
  });

  it('ignores clicks on the items of a read-only menu', async () => {
    const onChange = vi.fn();
    render(
      <RepositoriesSelect
        slug="acme"
        value={['acme/worker']}
        onChange={onChange}
        readOnlyBecause={because}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Repositories' }));
    await userEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: 'acme/worker' }),
    );

    expect(onChange).not.toHaveBeenCalled();
  });
});
