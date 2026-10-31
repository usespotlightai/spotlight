import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';

describe('InboxAsked', () => {
  it('scrolls the description inside the card and keeps the title in view', () => {
    render(
      <InboxAsked
        station={null}
        title="Drain the stuck retry queues"
        description="Start with webhook-retries."
        attachments={[]}
      />,
    );

    expect(
      screen
        .getByText('Start with webhook-retries.')
        .closest('[data-slot="scroll-area"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByRole('heading', { name: 'Drain the stuck retry queues' })
        .closest('[data-slot="scroll-area"]'),
    ).toBeNull();
  });
});
