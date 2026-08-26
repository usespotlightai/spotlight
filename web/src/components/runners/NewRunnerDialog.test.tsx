import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewRunnerDialog } from '@/components/runners/NewRunnerDialog';

const enrol = vi.hoisted(() => ({
  isPending: false,
  error: null as Error | null,
  reset: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock('@/hooks/api/useEnrolRunner', () => ({
  useEnrolRunner: () => enrol,
}));

beforeEach(() => {
  enrol.isPending = false;
  enrol.error = null;
  enrol.mutate = vi.fn();
});

const openDialog = () =>
  render(<NewRunnerDialog open onOpenChange={vi.fn()} />);

const fill = async (name: string, pool: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: 'Runner name' }), name);
  await user.type(screen.getByRole('textbox', { name: 'Pool' }), pool);
  return user;
};

describe('NewRunnerDialog', () => {
  it('will not enrol until both the name and the pool are given', async () => {
    openDialog();
    const create = screen.getByRole('button', { name: /Create runner/ });

    expect(create).toBeDisabled();

    await fill('Laptop', 'dev');

    expect(create).toBeEnabled();
  });

  it('sends what was typed, trimmed', async () => {
    openDialog();

    const user = await fill('  Laptop  ', '  dev  ');
    await user.click(screen.getByRole('button', { name: /Create runner/ }));

    expect(enrol.mutate.mock.calls[0][0]).toEqual({
      name: 'Laptop',
      pool: 'dev',
    });
  });

  // The token is shown once. Enrolling the first runner fills the fleet list,
  // and a dialog rendered inside the empty state used to unmount with it.
  it('shows the token once enrolled, and keeps showing it', async () => {
    enrol.mutate = vi.fn((_input, options) =>
      options.onSuccess({ id: 'r1', name: 'Laptop', token: 'spot_secret' }),
    );

    openDialog();
    const user = await fill('Laptop', 'dev');
    await user.click(screen.getByRole('button', { name: /Create runner/ }));

    await waitFor(() =>
      expect(screen.getByText('spot_secret')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Copy token' })).toBeVisible();
  });

  // The reset waits for the close animation to finish, so that the token is
  // not swapped back to the empty form while the dialog is still on screen.
  // Reopening has to start clean all the same.
  it('forgets the token once the dialog has closed', async () => {
    enrol.mutate = vi.fn((_input, options) =>
      options.onSuccess({ id: 'r1', name: 'Laptop', token: 'spot_secret' }),
    );

    const { rerender } = render(
      <NewRunnerDialog open onOpenChange={vi.fn()} />,
    );
    const user = await fill('Laptop', 'dev');
    await user.click(screen.getByRole('button', { name: /Create runner/ }));
    await waitFor(() =>
      expect(screen.getByText('spot_secret')).toBeInTheDocument(),
    );

    rerender(<NewRunnerDialog open={false} onOpenChange={vi.fn()} />);
    rerender(<NewRunnerDialog open onOpenChange={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Runner name' })).toHaveValue(
        '',
      ),
    );
    expect(screen.queryByText('spot_secret')).not.toBeInTheDocument();
  });

  it('says so when the control plane refused', () => {
    enrol.error = new Error('A runner name must not be empty');

    openDialog();

    expect(
      screen.getByText('A runner name must not be empty'),
    ).toBeInTheDocument();
  });
});
