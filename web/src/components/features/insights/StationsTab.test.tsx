import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StationsTab } from '@/components/features/insights/StationsTab';
import { DEFAULT_PERIOD } from '@/lib/insights';
import { seedStations } from '@/stories/fixtures/insights';
import { SLUG, TEAM_ID } from '@/stories/fixtures/team';

const showing = (path: string) => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  seedStations(client);

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <StationsTab
          slug={SLUG}
          teamId={TEAM_ID}
          period={DEFAULT_PERIOD}
          names={new Map()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('the Stations tab', () => {
  const scrolled = vi.fn();

  afterEach(() => {
    scrolled.mockReset();
    vi.restoreAllMocks();
  });

  it('scrolls to the station a link names, such as one an alert points at', () => {
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(scrolled);

    showing('/insights?tab=stations#station-station_triage');

    const reports = screen
      .getAllByRole('listitem')
      .filter((each) => each.dataset.slot === 'station-report');
    const triage = reports.find((each) => each.id === 'station-station_triage');
    expect(triage).toBeDefined();
    expect(scrolled).toHaveBeenCalledWith({ block: 'center' });
  });
});
