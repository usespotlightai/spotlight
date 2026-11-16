import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTabLinks } from '@/hooks/useTabLinks';
import { tabPathOf } from '@/lib/app-tabs';

const ORIGIN = window.location.origin;

function Links({ openAt }: { openAt: (path: string) => void }) {
  useTabLinks('acme', openAt);

  return (
    <>
      <a href="/w/acme/inbox/task_1?tab=notes">
        <span>The task</span>
      </a>
      <a href="/w/other/inbox">Another workspace</a>
      <a href="https://github.com/acme/api/pull/1">The pull request</a>
      <a href="/w/acme/files/report.pdf" download>
        The report
      </a>
    </>
  );
}

const renderLinks = () => {
  const openAt = vi.fn();
  render(<Links openAt={openAt} />);

  return openAt;
};

describe('tabPathOf', () => {
  it('takes the page of a link in the workspace', () => {
    expect(tabPathOf(`${ORIGIN}/w/acme/runs#step`, ORIGIN, 'acme')).toBe(
      '/w/acme/runs#step',
    );
    expect(tabPathOf('/w/acme', ORIGIN, 'acme')).toBe('/w/acme');
  });

  it.each([
    '/w/acme-labs/inbox',
    '/w/other/inbox',
    'https://example.com/w/acme/inbox',
    '/sign-in',
  ])('refuses %s', (href) => {
    expect(tabPathOf(href, ORIGIN, 'acme')).toBeNull();
  });
});

describe('useTabLinks', () => {
  it('opens a Command-clicked link in the workspace in a Spotlight tab', () => {
    const openAt = renderLinks();

    const event = fireEvent.click(screen.getByText('The task'), {
      metaKey: true,
    });

    expect(event).toBe(false);
    expect(openAt).toHaveBeenCalledExactlyOnceWith(
      '/w/acme/inbox/task_1?tab=notes',
    );
  });

  it('opens a middle-clicked link in a Spotlight tab', () => {
    const openAt = renderLinks();

    fireEvent(
      screen.getByText('The task'),
      new MouseEvent('auxclick', {
        bubbles: true,
        cancelable: true,
        button: 1,
      }),
    );

    expect(openAt).toHaveBeenCalledExactlyOnceWith(
      '/w/acme/inbox/task_1?tab=notes',
    );
  });

  it('leaves plain clicks and other links to the browser', () => {
    const openAt = renderLinks();

    fireEvent.click(screen.getByText('The task'));
    fireEvent.click(screen.getByText('Another workspace'), { metaKey: true });
    fireEvent.click(screen.getByText('The pull request'), { metaKey: true });
    fireEvent.click(screen.getByText('The report'), { metaKey: true });

    expect(openAt).not.toHaveBeenCalled();
  });
});
