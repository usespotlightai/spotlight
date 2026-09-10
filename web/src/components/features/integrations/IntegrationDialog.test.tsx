import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IntegrationDialog } from '@/components/features/integrations/IntegrationDialog';

const set = vi.fn().mockResolvedValue(undefined);
const state = vi.fn(() => ({ isPending: false, error: null }));
const connect = vi.fn();

vi.mock('@/hooks/api/useSetSecret', () => ({
  useSetSecret: () => ({ mutateAsync: set, ...state() }),
}));

vi.mock('@/hooks/api/useConnectIntegration', () => ({
  useConnectIntegration: () => ({
    mutate: connect,
    isPending: false,
    error: null,
  }),
}));

const integration = (over: Record<string, unknown> = {}) => ({
  source: 'linear',
  name: 'Linear',
  deliverTo: 'https://spotlight.test/deliveries/x',
  secrets: [{ name: 'LINEAR_WEBHOOK_SECRET', set: false }],
  happenings: [
    { happening: 'linear.issue.completed', label: 'Issue completed' },
  ],
  connectable: false,
  connection: null,
  ...over,
});

const showing = (
  over: Record<string, unknown> = {},
  onOpenChange = vi.fn(),
) => {
  render(
    <IntegrationDialog
      integration={integration(over)}
      teamId="team_1"
      open
      onOpenChange={onOpenChange}
    />,
  );
  return { onOpenChange };
};

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

  it('asks for each secret the host reads, named as the config names it', () => {
    showing();

    expect(screen.getByPlaceholderText('Paste the secret')).toBeInTheDocument();
    expect(screen.getByLabelText('LINEAR_WEBHOOK_SECRET')).toBeInTheDocument();
  });

  it('asks for every secret when a host reads more than one', () => {
    showing({
      secrets: [
        { name: 'SLACK_SIGNING_SECRET', set: true },
        { name: 'SLACK_BOT_TOKEN', set: false },
      ],
    });

    expect(screen.getByLabelText('SLACK_SIGNING_SECRET')).toBeInTheDocument();
    expect(screen.getByLabelText('SLACK_BOT_TOKEN')).toBeInTheDocument();
  });

  // Nothing to show, and a row of dots would suggest there were.
  it('says a secret is set rather than showing anything', () => {
    showing({ secrets: [{ name: 'LINEAR_WEBHOOK_SECRET', set: true }] });

    expect(screen.getByPlaceholderText('Paste to replace')).toBeInTheDocument();
  });

  it('never puts the secret where it could be read', async () => {
    showing();

    const field = screen.getByLabelText('LINEAR_WEBHOOK_SECRET');
    await userEvent.type(field, 'whsec_abc');

    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveAttribute('autocomplete', 'off');
  });

  it('saves what was entered under the name the config gives it, from one button', async () => {
    const { onOpenChange } = showing();

    await userEvent.type(
      screen.getByLabelText('LINEAR_WEBHOOK_SECRET'),
      'whsec_abc',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(set).toHaveBeenCalledWith({
      name: 'LINEAR_WEBHOOK_SECRET',
      value: 'whsec_abc',
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('saves every secret that was entered, together', async () => {
    set.mockClear();
    showing({
      secrets: [
        { name: 'SLACK_SIGNING_SECRET', set: false },
        { name: 'SLACK_BOT_TOKEN', set: false },
      ],
    });

    await userEvent.type(screen.getByLabelText('SLACK_SIGNING_SECRET'), 'shhh');
    await userEvent.type(screen.getByLabelText('SLACK_BOT_TOKEN'), 'xoxb-1');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(set).toHaveBeenCalledWith({
      name: 'SLACK_SIGNING_SECRET',
      value: 'shhh',
    });
    expect(set).toHaveBeenCalledWith({
      name: 'SLACK_BOT_TOKEN',
      value: 'xoxb-1',
    });
  });

  it('saves nothing and just closes when nothing was entered', async () => {
    set.mockClear();
    const { onOpenChange } = showing();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(set).not.toHaveBeenCalled();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('offers to connect a host that links by authorizing, and begins on click', async () => {
    showing({ connectable: true, connection: null });

    await userEvent.click(
      screen.getByRole('button', { name: 'Connect to Linear' }),
    );

    expect(connect).toHaveBeenCalledWith('linear');
  });

  it('says who a connected host took the team to be', () => {
    showing({ connectable: true, connection: { handle: 'Acme' } });

    expect(screen.getByText('Connected as Acme')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reconnect' }),
    ).toBeInTheDocument();
  });

  it('does not offer to connect a host that does not link that way', () => {
    showing();

    expect(
      screen.queryByRole('button', { name: /Connect to/ }),
    ).not.toBeInTheDocument();
  });
});
