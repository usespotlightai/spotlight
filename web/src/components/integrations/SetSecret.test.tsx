import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SetSecret } from '@/components/integrations/SetSecret';

const set = vi.fn();
const state = vi.fn(() => ({ isPending: false }));

vi.mock('@/hooks/api/useSetSecret', () => ({
  useSetSecret: () => ({ mutate: set, ...state() }),
}));

const showing = (isSet = false) =>
  render(
    <SetSecret teamId="team_1" name="LINEAR_WEBHOOK_SECRET" isSet={isSet} />,
  );

describe('SetSecret', () => {
  it('asks for the secret the file names', () => {
    showing();

    expect(
      screen.getByPlaceholderText('Paste LINEAR_WEBHOOK_SECRET'),
    ).toBeInTheDocument();
  });

  // Nothing to show, and a row of dots would suggest there were.
  it('says it is set rather than showing anything', () => {
    showing(true);

    expect(
      screen.getByPlaceholderText('Set. Type to replace it.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
  });

  it('never puts the secret where it could be read', async () => {
    showing();

    const field = screen.getByLabelText('LINEAR_WEBHOOK_SECRET');
    await userEvent.type(field, 'whsec_abc');

    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveAttribute('autocomplete', 'off');
  });

  it('sends it when asked', async () => {
    showing();

    await userEvent.type(
      screen.getByLabelText('LINEAR_WEBHOOK_SECRET'),
      'whsec_abc',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(set).toHaveBeenCalledWith(
      { name: 'LINEAR_WEBHOOK_SECRET', value: 'whsec_abc' },
      expect.anything(),
    );
  });

  it('will not send an empty one', () => {
    showing();

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
