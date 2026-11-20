import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PersonMessage } from '@/components/features/inbox/conversation/PersonMessage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PersonMessage', () => {
  it('opens a long message that is cut off', () => {
    const notices: (() => void)[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notices.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const { container } = render(
      <PersonMessage
        body="Why does this log keep failing?"
        attachments={[]}
        authors={[]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement;
    Object.defineProperty(viewport, 'clientHeight', { value: 128 });
    Object.defineProperty(viewport, 'scrollHeight', { value: 400 });
    act(() => {
      for (const notice of notices) {
        notice();
      }
    });

    expect(
      screen.getByRole('button', { name: 'Show the whole message' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the avatars of everyone who wrote the message', () => {
    render(
      <PersonMessage
        body="Cap it at 500."
        attachments={[]}
        authors={[
          { id: 'user_1', name: 'Anna', image: null },
          { id: 'user_2', name: 'Ben', image: null },
        ]}
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Anna and Ben wrote this' }),
    ).toBeInTheDocument();
  });

  it('shows no avatars where nobody is named', () => {
    render(
      <PersonMessage body="Cap it at 500." attachments={[]} authors={[]} />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
