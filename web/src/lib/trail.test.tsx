import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useTrail } from '@/lib/trail';

const base: BreadcrumbSegment[] = [
  { label: 'Acme', avatar: 'Acme', to: '/w/a/team/t' },
  { label: 'Default', to: '/w/a/team/t/lines/l' },
  { label: 'Fix the queue' },
];

function Probe({
  base: given,
  own,
}: {
  base: BreadcrumbSegment[];
  own?: number;
}) {
  const { trail, forward } = useTrail(given, own);

  return (
    <>
      <span data-testid="trail">
        {trail.map((each) => each.label).join(' / ')}
      </span>
      <span data-testid="forward">
        {forward.map((each) => each.label).join(' / ')}
      </span>
    </>
  );
}

const at = (entry: { pathname: string; state?: unknown }, own?: number) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Probe base={base} own={own} />
    </MemoryRouter>,
  );

describe('useTrail', () => {
  it('falls back to the page hierarchy when no trail was carried', () => {
    at({ pathname: '/w/a/team/t/tasks/x' });

    expect(screen.getByTestId('trail')).toHaveTextContent(
      'Acme / Default / Fix the queue',
    );
  });

  it('shows the carried trail in place of the hierarchy', () => {
    at({
      pathname: '/w/a/team/t/tasks/x',
      state: { trail: [{ label: 'Inbox', to: '/w/a/inbox' }] },
    });

    expect(screen.getByTestId('trail')).toHaveTextContent(
      'Inbox / Fix the queue',
    );
  });

  it('keeps every crumb a page owns after the carried trail', () => {
    at(
      {
        pathname: '/w/a/team/t/runs/r',
        state: { trail: [{ label: 'Runs', to: '/w/a/team/t/runs' }] },
      },
      2,
    );

    expect(screen.getByTestId('trail')).toHaveTextContent(
      'Runs / Default / Fix the queue',
    );
  });

  it('names a crumb once when the trail already ends there', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/w/a/team/t/runs/r',
            state: {
              trail: [
                { label: 'Spotlight', to: '/w/a/team/t' },
                { label: 'Setup docs', to: '/w/a/team/t/tasks/x' },
              ],
            },
          },
        ]}
      >
        <Probe
          base={[
            { label: 'Spotlight', to: '/w/a/team/t' },
            { label: 'Setup docs', to: '/w/a/team/t/tasks/x' },
            { label: 'Implementation' },
          ]}
          own={2}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('trail')).toHaveTextContent(
      'Spotlight / Setup docs / Implementation',
    );
  });

  it('ignores an empty carried trail', () => {
    at({ pathname: '/w/a/team/t/tasks/x', state: { trail: [] } });

    expect(screen.getByTestId('trail')).toHaveTextContent(
      'Acme / Default / Fix the queue',
    );
  });

  it('hands its own crumb on, linked to where it stands', () => {
    at({ pathname: '/w/a/team/t/tasks/x' });

    expect(screen.getByTestId('forward')).toHaveTextContent(
      'Acme / Default / Fix the queue',
    );
  });
});
