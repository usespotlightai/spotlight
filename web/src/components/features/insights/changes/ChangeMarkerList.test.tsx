import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ChangeMarkerList } from '@/components/features/insights/changes/ChangeMarkerList';
import type { ConfigOrigin } from '@/lib/insights-candidates';
import {
  EFFORT_CHANGE,
  ORIGINS,
  REVIEW_CHANGE,
} from '@/stories/fixtures/insights-changes';

const showing = (origins: readonly ConfigOrigin[]) =>
  render(
    <MemoryRouter>
      <ChangeMarkerList
        slug="acme"
        teamId="team_platform"
        markers={[EFFORT_CHANGE, REVIEW_CHANGE]}
        origins={origins}
        names={new Map()}
      />
    </MemoryRouter>,
  );

describe('ChangeMarkerList', () => {
  it('names the candidate a config change came from, leading to its replay', () => {
    showing(ORIGINS);

    expect(
      screen.getByRole('link', { name: 'one-comment-per-problem' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_platform/lines/line_delivery/stations/station_review/replays/replay_one_comment',
    );
    expect(screen.getAllByText(/^From/)).toHaveLength(1);
  });

  it('names no candidate while none is known for a change', () => {
    showing([]);

    expect(screen.queryByText(/^From/)).not.toBeInTheDocument();
  });
});
