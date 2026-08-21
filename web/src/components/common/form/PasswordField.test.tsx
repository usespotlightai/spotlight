import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PasswordField } from '@/components/common/form/PasswordField';

describe('PasswordField', () => {
  it('masks the value by default', () => {
    render(<PasswordField id="pw" autoComplete="current-password" />);

    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
    expect(
      screen.getByRole('button', { name: 'Show password' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('reveals the value when the toggle is pressed', async () => {
    const user = userEvent.setup();
    render(<PasswordField id="pw" autoComplete="current-password" />);

    await user.type(screen.getByLabelText('Password'), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Password')).toHaveValue('hunter2hunter2');
  });

  it('masks it again on a second press', async () => {
    const user = userEvent.setup();
    render(<PasswordField id="pw" autoComplete="current-password" />);

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    await user.click(screen.getByRole('button', { name: 'Hide password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('does not submit the surrounding form', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <PasswordField id="pw" autoComplete="current-password" />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
