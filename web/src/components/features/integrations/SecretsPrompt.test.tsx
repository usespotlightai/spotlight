import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SecretsPrompt } from '@/components/features/integrations/SecretsPrompt';

const LINEAR = {
  source: 'linear',
  name: 'Linear',
  summary: 'Move a task on when its issue is done.',
  secrets: ['LINEAR_WEBHOOK_SECRET'],
  deliverTo:
    'https://app-dev.usespotlight.ai/api/webhooks/w/acme/t/core/linear',
};

const SENTRY = {
  ...LINEAR,
  source: 'sentry',
  name: 'Sentry',
  secrets: ['SENTRY_WEBHOOK_SECRET'],
  deliverTo:
    'https://app-dev.usespotlight.ai/api/webhooks/w/acme/t/core/sentry',
};

const showing = (integrations = [LINEAR], error: string | null = null) => {
  const onSubmit = vi.fn();
  render(
    <SecretsPrompt
      integrations={integrations}
      onOpenChange={vi.fn()}
      pending={false}
      error={error}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit };
};

const openButton = () =>
  screen.getByRole('button', { name: 'Open pull request' });

describe('SecretsPrompt', () => {
  it('shows each integration’s delivery URL, and asks for its secrets by name', () => {
    showing();

    expect(
      screen.getByRole('heading', { name: 'Connect Linear' }),
    ).toBeVisible();
    expect(screen.getByText(LINEAR.deliverTo)).toBeInTheDocument();
    expect(screen.getByLabelText(/Webhook secret/)).toBeInTheDocument();
  });

  it('hands over the secrets as typed once every one is given', async () => {
    const user = userEvent.setup();
    const { onSubmit } = showing();

    expect(openButton()).toBeDisabled();

    await user.type(screen.getByLabelText(/Webhook secret/), ' whsec_1 ');
    await user.click(openButton());

    expect(onSubmit).toHaveBeenCalledWith({
      LINEAR_WEBHOOK_SECRET: ' whsec_1 ',
    });
  });

  it('says why the pull request could not be opened', () => {
    showing([LINEAR], 'This team has nowhere to keep secrets yet.');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This team has nowhere to keep secrets yet.',
    );
  });

  it('takes several integrations one step at a time, keeping what was typed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = showing([LINEAR, SENTRY]);

    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.type(screen.getByLabelText(/Webhook secret/), 'lin_1');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      screen.getByRole('heading', { name: 'Connect Sentry' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText(/Webhook secret/)).toHaveValue('lin_1');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.type(screen.getByLabelText(/Webhook secret/), 'sen_1');
    await user.click(openButton());

    expect(onSubmit).toHaveBeenCalledWith({
      LINEAR_WEBHOOK_SECRET: 'lin_1',
      SENTRY_WEBHOOK_SECRET: 'sen_1',
    });
  });
});
