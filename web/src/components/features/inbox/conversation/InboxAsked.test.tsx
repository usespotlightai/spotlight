import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import { scrollViewport, watchResizes } from '@/test/resize';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('offers to show the whole description when it is cut off', () => {
    const measure = watchResizes();
    const { container } = render(
      <InboxAsked
        station={null}
        title="Drain the stuck retry queues"
        description="Start with webhook-retries."
        attachments={[]}
      />,
    );
    measure(scrollViewport(container), {
      clientHeight: 128,
      scrollHeight: 400,
    });

    expect(
      screen.getByRole('button', { name: 'Show the whole description' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
});
