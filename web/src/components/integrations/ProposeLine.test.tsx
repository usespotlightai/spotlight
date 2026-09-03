import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProposeLine } from '@/components/integrations/ProposeLine';

const propose = vi.fn();
const state = vi.fn();

vi.mock('@/hooks/api/useProposeLine', () => ({
  useProposeLine: () => ({
    mutate: propose,
    ...state(),
  }),
}));

const showing = () =>
  render(<ProposeLine teamId="team_1" lineId="line_1" name="Default" />);

describe('ProposeLine', () => {
  it('names the line it would write back', () => {
    state.mockReturnValue({ isPending: false, isError: false });
    showing();

    expect(
      screen.getByRole('button', { name: 'Propose Default' }),
    ).toBeInTheDocument();
  });

  it('writes it back when asked', async () => {
    state.mockReturnValue({ isPending: false, isError: false });
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Propose Default' }),
    );

    expect(propose).toHaveBeenCalledWith('line_1', expect.anything());
  });

  it('says so while it is opening', () => {
    state.mockReturnValue({ isPending: true, isError: false });
    showing();

    expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled();
  });

  // The repository moved under the change, and what is in it now has not
  // been looked at.
  it('says what to do when the repository has moved', () => {
    state.mockReturnValue({ isPending: false, isError: true });
    showing();

    expect(screen.getByText(/Read it again, then propose/)).toBeInTheDocument();
  });
});
