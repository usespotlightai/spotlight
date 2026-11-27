import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExpandableText } from '@/components/shared/ExpandableText';
import { scrollViewport, watchResizes } from '@/test/resize';

const renderMeasured = () => {
  const measured = watchResizes();
  const { container } = render(
    <ExpandableText what="message">
      <p>
        The checks failed. <a href="https://example.com/run">Open the run</a>
      </p>
    </ExpandableText>,
  );
  const viewport = scrollViewport(container);

  return {
    measure: (sizes: Record<string, number>) => measured(viewport, sizes),
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExpandableText', () => {
  it('offers no toggle when the whole text fits', () => {
    const { measure } = renderMeasured();
    measure({ clientHeight: 128, scrollHeight: 64 });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens and closes a text that is cut off', () => {
    const { measure } = renderMeasured();
    measure({ clientHeight: 128, scrollHeight: 400 });

    const toggle = screen.getByRole('button', {
      name: 'Show the whole message',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(
      screen.getByRole('button', { name: 'Show less of the message' }),
    ).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(
      screen.getByRole('button', { name: 'Show less of the message' }),
    );
    expect(
      screen.getByRole('button', { name: 'Show the whole message' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps links in a closed text out of the toggle', () => {
    const { measure } = renderMeasured();
    measure({ clientHeight: 128, scrollHeight: 400 });

    const toggle = screen.getByRole('button', {
      name: 'Show the whole message',
    });
    const link = screen.getByRole('link', { name: 'Open the run' });

    expect(toggle).not.toContainElement(link);
    expect(toggle).not.toHaveClass('inset-0');
  });
});
