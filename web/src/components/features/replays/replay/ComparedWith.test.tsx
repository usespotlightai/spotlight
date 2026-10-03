import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ComparedWith } from '@/components/features/replays/replay/ComparedWith';
import type { ReplayDetail } from '@/lib/replay';

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'st_1',
};

const showing = (over: Partial<ReplayDetail>) =>
  render(
    <MemoryRouter>
      <ComparedWith
        at={AT}
        replay={
          {
            candidate: { kind: 'searched' },
            baselineReplayId: 'replay_base',
            comparedWithReplayId: 'replay_seed',
            ...over,
          } as ReplayDetail
        }
      />
    </MemoryRouter>,
  );

describe('ComparedWith', () => {
  it('names and leads to the replay each task is compared with', () => {
    showing({});

    expect(
      screen.getByRole('link', { name: 'the search’s starting config' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/st_1/replays/replay_seed',
    );
  });

  it('says nothing where the replay is compared with nothing', () => {
    const { container } = showing({ comparedWithReplayId: null });

    expect(container).toBeEmptyDOMElement();
  });
});
