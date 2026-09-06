import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepositorySelect } from '@/components/features/board/task/RepositorySelect';

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({
    data: [{ fullName: 'acme/widgets' }, { fullName: 'acme/gadgets' }],
  }),
}));

const open = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Repository'));
  await screen.findByRole('menu');
  return user;
};

describe('RepositorySelect', () => {
  it('says nothing is picked until something is', () => {
    render(<RepositorySelect slug="acme" value="" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Repository')).toHaveTextContent(
      'No repository',
    );
  });

  it('shows what is picked', () => {
    render(
      <RepositorySelect slug="acme" value="acme/widgets" onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText('Repository')).toHaveTextContent(
      'acme/widgets',
    );
  });

  it('offers every repository Spotlight can reach, and none', async () => {
    render(<RepositorySelect slug="acme" value="" onChange={vi.fn()} />);
    await open();

    expect(
      screen.getByRole('menuitemradio', { name: 'acme/widgets' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'acme/gadgets' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'No repository' }),
    ).toBeInTheDocument();
  });

  it('hands back the one that was picked', async () => {
    const picked = vi.fn();
    render(<RepositorySelect slug="acme" value="" onChange={picked} />);
    const user = await open();

    await user.click(
      screen.getByRole('menuitemradio', { name: 'acme/widgets' }),
    );

    expect(picked).toHaveBeenCalledWith('acme/widgets');
  });

  it('hands back nothing when the choice is cleared', async () => {
    const picked = vi.fn();
    render(
      <RepositorySelect slug="acme" value="acme/widgets" onChange={picked} />,
    );
    const user = await open();

    await user.click(
      screen.getByRole('menuitemradio', { name: 'No repository' }),
    );

    expect(picked).toHaveBeenCalledWith('');
  });
});
