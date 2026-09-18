import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewRunnerDialog } from '@/components/features/runners/NewRunnerDialog';

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
  render(<NewRunnerDialog slug="acme" open onOpenChange={vi.fn()} />);

const fill = async (name: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: 'Runner name' }), name);
  return user;
};

describe('NewRunnerDialog', () => {
  it('will not enrol until a name is given', async () => {
    openDialog();
    const create = screen.getByRole('button', { name: /Create runner/ });

    expect(create).toBeDisabled();

    await fill('Laptop');

    expect(create).toBeEnabled();
  });

  it('sends what was typed, trimmed', async () => {
    openDialog();

    const user = await fill('  Laptop  ');
    await user.click(screen.getByRole('button', { name: /Create runner/ }));

    expect(enrol.mutate.mock.calls[0][0]).toEqual({
      name: 'Laptop',
    });
  });

  it('shows the token once enrolled, and keeps showing it', async () => {
    enrol.mutate = vi.fn((_input, options) =>
      options.onSuccess({ id: 'r1', name: 'Laptop', token: 'a-secret-token' }),
    );

    openDialog();
    const user = await fill('Laptop');
    await user.click(screen.getByRole('button', { name: /Create runner/ }));

    await waitFor(() =>
      expect(screen.getByText('a-secret-token')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Copy token' })).toBeVisible();
  });

  it('forgets the token once the dialog has closed', async () => {
    enrol.mutate = vi.fn((_input, options) =>
      options.onSuccess({ id: 'r1', name: 'Laptop', token: 'a-secret-token' }),
    );

    const { rerender } = render(
      <NewRunnerDialog slug="acme" open onOpenChange={vi.fn()} />,
    );
    const user = await fill('Laptop');
    await user.click(screen.getByRole('button', { name: /Create runner/ }));
    await waitFor(() =>
      expect(screen.getByText('a-secret-token')).toBeInTheDocument(),
    );

    rerender(
      <NewRunnerDialog slug="acme" open={false} onOpenChange={vi.fn()} />,
    );
    rerender(<NewRunnerDialog slug="acme" open onOpenChange={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Runner name' })).toHaveValue(
        '',
      ),
    );
    expect(screen.queryByText('a-secret-token')).not.toBeInTheDocument();
  });

  it('says so when the control plane refused', () => {
    enrol.error = new Error('A runner name must not be empty');

    openDialog();

    expect(
      screen.getByText('A runner name must not be empty'),
    ).toBeInTheDocument();
  });
});
