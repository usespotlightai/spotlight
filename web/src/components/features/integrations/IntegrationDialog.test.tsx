import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IntegrationDialog } from '@/components/features/integrations/IntegrationDialog';

const set = vi.fn();
const state = vi.fn(() => ({ isPending: false, error: null }));

vi.mock('@/hooks/api/useSetSecret', () => ({
  useSetSecret: () => ({ mutate: set, ...state() }),
}));

const integration = (over: Record<string, unknown> = {}) => ({
  source: 'linear',
  name: 'Linear',
  deliverTo: 'https://spotlight.test/deliveries/x',
  secret: 'LINEAR_WEBHOOK_SECRET',
  secretSet: false,
  happenings: [
    { happening: 'linear.issue.completed', label: 'Issue completed' },
  ],
  ...over,
});

const showing = (over: Record<string, unknown> = {}) =>
  render(
    <IntegrationDialog
      integration={integration(over)}
      teamId="team_1"
      open
      onOpenChange={vi.fn()}
    />,
  );

describe('IntegrationDialog', () => {
  it('gives the address to point the host at', () => {
    showing();

    expect(
      screen.getByText('https://spotlight.test/deliveries/x'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy the address' }),
    ).toBeInTheDocument();
  });

  it('asks for the secret without naming the variable at people', () => {
    showing();

    expect(
      screen.getByPlaceholderText('Paste the webhook secret'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Webhook secret')).toBeInTheDocument();
  });

  // Nothing to show, and a row of dots would suggest there were.
  it('says it is set rather than showing anything', () => {
    showing({ secretSet: true });

    expect(screen.getByPlaceholderText('Replace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
  });

  it('never puts the secret where it could be read', async () => {
    showing();

    const field = screen.getByLabelText('Webhook secret');
    await userEvent.type(field, 'whsec_abc');

    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveAttribute('autocomplete', 'off');
  });

  it('sends it from the footer, where the dialog is finished', async () => {
    showing();

    await userEvent.type(screen.getByLabelText('Webhook secret'), 'whsec_abc');
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

  it('offers a way out that changes nothing', () => {
    showing();

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
