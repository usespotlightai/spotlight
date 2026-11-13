import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';

describe('Breadcrumbs', () => {
  it('names each crumb in full for when the pane cuts it short', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          namesTab={false}
          segments={[
            { label: 'Platform', to: '/team' },
            { label: 'Upgrade the Postgres driver' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Platform' })).toHaveAttribute(
      'title',
      'Platform',
    );
    expect(screen.getByTitle('Upgrade the Postgres driver')).toHaveTextContent(
      'Upgrade the Postgres driver',
    );
  });

  it('shows each label whole and leaves the cut to the pane', () => {
    const leaf =
      'Tune the retry backoff, one pass at a time, until the queue drains';

    render(
      <MemoryRouter>
        <Breadcrumbs
          namesTab={false}
          segments={[{ label: 'Agent', to: '/agent' }, { label: leaf }]}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByTitle(leaf)).toHaveLength(1);
    expect(screen.getAllByTitle('Agent')).toHaveLength(1);
    expect(screen.getByTitle(leaf)).toHaveTextContent(leaf);
  });
});
