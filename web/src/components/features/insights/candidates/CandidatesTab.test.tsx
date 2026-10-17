import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidatesTab } from '@/components/features/insights/candidates/CandidatesTab';
import type { InsightsPeriod } from '@/lib/insights';
import { stationNamesOf } from '@/lib/insights';
import { CANDIDATES } from '@/test/fixtures/insights-candidates';

type Queried = {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
  errorUpdateCount: number;
  refetch: () => void;
};

const queried = (data: unknown, errorUpdateCount = 0): Queried => ({
  data,
  isPending: data === undefined && errorUpdateCount === 0,
  isFetching: false,
  errorUpdateCount,
  refetch: vi.fn(),
});

const LINES = [
  {
    id: 'line_delivery',
    key: 'delivery',
    name: 'Delivery',
    repositories: [],
    reactions: [],
    stations: [
      {
        id: 'station_implementation',
        key: 'implementation',
        name: 'Implementation',
        kind: 'work',
        color: '#000',
        position: 0,
      },
      {
        id: 'station_review',
        key: 'review',
        name: 'Code Review',
        kind: 'work',
        color: '#000',
        position: 1,
      },
    ],
  },
];

const answer: {
  candidates: Queried;
  lines: unknown;
  asked: unknown[];
} = {
  candidates: queried(undefined),
  lines: LINES,
  asked: [],
};

vi.mock('@/hooks/api/useInsightsCandidates', () => ({
  insightsCandidatesKeys: { forTeam: () => ['insights', 'candidates'] },
  useInsightsCandidates: (teamId: string, period: string) => {
    answer.asked.push({ teamId, period });
    return answer.candidates;
  },
}));
vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({ data: answer.lines }),
}));

const STATION = '/w/acme/team/team_1/lines/line_delivery/stations';

const showing = (period: InsightsPeriod = '30d') =>
  render(
    <MemoryRouter>
      <CandidatesTab
        slug="acme"
        teamId="team_1"
        period={period}
        names={stationNamesOf(
          (answer.lines ?? []) as Parameters<typeof stationNamesOf>[0],
        )}
      />
    </MemoryRouter>,
  );

const row = (name: string) =>
  screen
    .getByText(name)
    .closest('[data-slot="replayed-candidate"]') as HTMLElement;

beforeEach(() => {
  answer.candidates = queried(CANDIDATES);
  answer.lines = LINES;
  answer.asked = [];
});

describe('the Candidates tab', () => {
  it('asks for the candidates replayed in its period', () => {
    showing('7d');

    expect(answer.asked).toContainEqual({ teamId: 'team_1', period: '7d' });
  });

  it('shows a faithful skeleton while it loads', () => {
    answer.candidates = queried(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the candidates' }),
    ).toBeInTheDocument();
  });

  it('offers to try again where it could not load', async () => {
    answer.candidates = queried(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answer.candidates.refetch).toHaveBeenCalled();
  });

  it('explains replays and leads to the line where nothing was replayed', () => {
    answer.candidates = queried({ ...CANDIDATES, stations: [] });

    showing();

    expect(
      screen.getByText('No candidates replayed in this period'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Replay a station’s past tasks under a changed config/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the line' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_delivery',
    );
  });

  it('notes when the oldest replays were left out', () => {
    answer.candidates = queried({ ...CANDIDATES, truncated: true });

    showing();

    expect(screen.getByRole('note')).toHaveTextContent(
      'Only the latest replays in this period are counted',
    );
  });

  it('groups the candidates in one table by station, then replay set, saying how far to trust each set', () => {
    showing();

    const groups = [
      ...document.querySelectorAll('[data-slot="nested-group"]'),
    ].map((each) => each.textContent);
    expect(groups).toEqual([
      'ImplementationDelivery',
      expect.stringMatching(/^Migrations and billing24 tasks \(27 runs\)/),
      'Code ReviewDelivery',
      expect.stringMatching(/^Reviews sent back12 tasks/),
    ]);
    expect(
      screen.getByRole('link', { name: 'Migrations and billing' }),
    ).toHaveAttribute(
      'href',
      `${STATION}/station_implementation/replay-sets/set_implementation`,
    );
    expect(screen.getAllByLabelText('Checks pull requests')).toHaveLength(1);
    expect(screen.getAllByLabelText('How far to trust this set')).toHaveLength(
      2,
    );
  });

  it('folds a station or a replay set away and opens it again', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Fold Implementation' }),
    );
    expect(screen.queryByText('opus-with-migrations-skill')).toBeNull();
    expect(screen.getByText('review-against-spec')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Unfold Implementation' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Fold Reviews sent back' }),
    );
    expect(screen.getByText('opus-with-migrations-skill')).toBeInTheDocument();
    expect(screen.queryByText('review-against-spec')).toBeNull();
  });

  it('charts each replay set in place of its candidates, under the same folding rows', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Chart' }));

    expect(
      document.querySelectorAll('[data-slot="candidate-chart"]'),
    ).toHaveLength(2);
    expect(
      document.querySelector('[data-slot="replayed-candidate"]'),
    ).toBeNull();
  });

  it('lists each candidate with what changed, its success and cost beside live', () => {
    showing();

    const picked = row('opus-with-migrations-skill');
    expect(
      within(picked).getByRole('list', { name: 'What changed' }),
    ).toHaveTextContent(/model\s*=\s*"sonnet"\s*->\s*"opus"/);
    expect(within(picked).getByLabelText('Best value')).toBeInTheDocument();
    expect(picked).toHaveTextContent('SourceSearch');
    expect(picked).toHaveTextContent('Candidate72%Live56%');
    expect(picked).toHaveTextContent('Against liveBetter+16 pts');
    expect(picked).toHaveTextContent('Cost per run$0.82Live cost$0.60');
    expect(picked).toHaveTextContent('Runs18');
    expect(
      within(row('sonnet-plan-first')).queryByRole('list', {
        name: 'What changed',
      }),
    ).toBeNull();
    expect(
      document.querySelector('[data-slot="replayed-baseline"]'),
    ).toHaveTextContent('Live54%Cost per run–Live cost$0.62');
  });

  it('shows the held-out score in one column for every set', () => {
    showing();

    expect(row('opus-with-migrations-skill')).toHaveTextContent('Held out67%');
    expect(row('sonnet-terse-prompt')).toHaveTextContent('Held out–');
    expect(row('review-against-spec')).toHaveTextContent('Held out–');
  });

  it('leads Changes to the pull request, the search or the replay, whichever shows the change', () => {
    showing();

    expect(
      within(row('opus-with-migrations-skill')).getByRole('link', {
        name: 'Changes',
      }),
    ).toHaveAttribute(
      'href',
      'https://github.com/acme/spotlight-config/pull/42',
    );
    expect(
      within(row('sonnet-terse-prompt')).getByRole('link', {
        name: 'Changes',
      }),
    ).toHaveAttribute(
      'href',
      `${STATION}/station_implementation/searches/search_1#candidate-candidate_terse`,
    );

    const proposed = row('review-against-spec');
    expect(proposed).toHaveTextContent('SourceProposed');
    expect(
      within(proposed).getByRole('link', { name: 'Changes' }),
    ).toHaveAttribute(
      'href',
      `${STATION}/station_review/replays/replay_spec_review`,
    );
  });

  it('says a candidate was not compared with live where no task was compared', () => {
    const [station] = CANDIDATES.stations;
    answer.candidates = queried({
      ...CANDIDATES,
      stations: [
        {
          ...station,
          sets: station?.sets.map((set) => ({
            ...set,
            candidates: set.candidates.map((each) => ({
              ...each,
              againstLive: null,
              regressions: 0,
              compared: 0,
            })),
          })),
        },
      ],
    });

    showing();

    expect(row('opus-with-migrations-skill')).toHaveTextContent(
      'Against liveNot compared',
    );
  });

  it('still leads somewhere where the team’s lines have not loaded', () => {
    answer.candidates = queried({ ...CANDIDATES, stations: [] });
    answer.lines = undefined;

    showing();

    expect(
      screen.getByRole('link', { name: 'Open the team’s lines' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1');
  });

  it('expands a candidate whose changes run past the row, and folds it back', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(80);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(48);
    showing();

    const name = screen.getByRole('button', {
      name: 'opus-with-migrations-skill',
    });
    expect(name).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(name);
    expect(name).toHaveAttribute('aria-expanded', 'true');
    expect(row('opus-with-migrations-skill')).toHaveAttribute(
      'data-expanded',
      'true',
    );

    await userEvent.click(name);
    expect(name).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps a candidate that shows all of it from expanding', () => {
    showing();

    expect(
      screen.queryByRole('button', { name: 'opus-with-migrations-skill' }),
    ).toBeNull();
  });
});
