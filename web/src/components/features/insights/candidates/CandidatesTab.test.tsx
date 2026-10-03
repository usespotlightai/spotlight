import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamInsights } from '@/components/features/insights/TeamInsights';
import { CANDIDATES } from '@/stories/fixtures/insights-candidates';

type Held = {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
  errorUpdateCount: number;
  refetch: () => void;
};

const held = (data: unknown, errorUpdateCount = 0): Held => ({
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

const answer: { candidates: Held; lines: unknown; asked: unknown[] } = {
  candidates: held(undefined),
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

const showing = (query = '?tab=candidates') =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/team/team_1/insights${query}`]}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/insights"
          element={<TeamInsights slug="acme" teamId="team_1" />}
        />
      </Routes>
    </MemoryRouter>,
  );

const card = (name: string) =>
  screen
    .getByRole('heading', { name })
    .closest('[data-slot="insights-card"]') as HTMLElement;

const row = (name: string) =>
  screen
    .getByText(name, { selector: 'span' })
    .closest('[data-slot="replayed-candidate"]') as HTMLElement;

beforeEach(() => {
  answer.candidates = held(CANDIDATES);
  answer.lines = LINES;
  answer.asked = [];
});

describe('the Candidates tab', () => {
  it('is a tab of Insights after Changes, keeping the period', () => {
    showing('?tab=candidates&period=7d');

    const tabs = screen.getAllByRole('link').map((each) => each.textContent);
    expect(tabs.indexOf('Candidates')).toBe(tabs.indexOf('Changes') + 1);
    expect(
      screen.getByRole('link', { name: 'Candidates', current: 'page' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=candidates&period=7d',
    );
    expect(answer.asked).toContainEqual({ teamId: 'team_1', period: '7d' });
  });

  it('shows a faithful skeleton while it loads', () => {
    answer.candidates = held(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the candidates' }),
    ).toBeInTheDocument();
  });

  it('offers to try again where it could not load', async () => {
    answer.candidates = held(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answer.candidates.refetch).toHaveBeenCalled();
  });

  it('explains replays and leads to the line where nothing was replayed', () => {
    answer.candidates = held({ ...CANDIDATES, stations: [] });

    showing();

    expect(
      screen.getByText('No candidates replayed in this period'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /runs a station’s past tasks again against a changed config, without applying it/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the line' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_delivery',
    );
  });

  it('notes when the oldest replays were left out', () => {
    answer.candidates = held({ ...CANDIDATES, truncated: true });

    showing();

    expect(screen.getByRole('note')).toHaveTextContent(
      'Only the latest replays over this period are counted',
    );
  });

  it('gives each station a card, with its replay set’s health and the unpriced listed apart from the chart', () => {
    showing();

    const implementation = card('Implementation');
    expect(card('Code Review')).toBeInTheDocument();
    expect(
      within(implementation).getByRole('link', {
        name: 'Migrations and billing',
      }),
    ).toHaveAttribute(
      'href',
      `${STATION}/station_implementation/replay-sets/set_implementation`,
    );
    expect(
      within(implementation).getByText('Guards changes'),
    ).toBeInTheDocument();
    expect(
      implementation.querySelector('[data-slot="replay-set-health"]'),
    ).toHaveTextContent(
      /24 tasks \(27 runs\) · ended 3–41 days ago · last added 2 days ago/,
    );
    const noise = implementation.querySelector(
      '[data-slot="health-line"][data-key="noise"]',
    );
    expect(noise).toHaveTextContent(
      'Noise: Success moved 13 pts between 3 copies',
    );
    expect(noise).toHaveAttribute('data-tone', 'bad');
    expect(
      within(
        within(card('Code Review')).getByRole('list', { name: /^Health of / }),
      ).getAllByRole('listitem'),
    ).toHaveLength(5);
    expect(
      card('Code Review').querySelector(
        '[data-slot="health-line"][data-key="judge"]',
      ),
    ).toHaveTextContent('Judge agreeing with itself: Not checked');
    expect(
      implementation.querySelector('[data-slot="unpriced"]'),
    ).toHaveTextContent(
      'Not priced, so not shown: cursor-careful-profile (61%).',
    );
    expect(
      implementation.querySelector('[data-slot="unfinished"]'),
    ).toHaveTextContent(
      'Not finished, so not shown: sonnet-plan-first (running).',
    );
  });

  it('lists each candidate behind the chart, with its scores, cost and comparison with live', async () => {
    showing();

    await userEvent.click(
      within(card('Implementation')).getByRole('button', {
        name: 'Show table',
      }),
    );

    const picked = row('opus-with-migrations-skill');
    expect(picked).toHaveTextContent('Searched');
    expect(picked).toHaveTextContent('On the frontier');
    expect(picked).toHaveTextContent(
      'Sent-back runs mostly forgot the migration order',
    );
    expect(
      within(picked).getByRole('list', { name: 'What changed' }),
    ).toBeInTheDocument();
    expect(picked).toHaveTextContent('Replayed16 tasks (18 runs)');
    expect(picked).toHaveTextContent(
      'Search score72% (50–89%) of 18 runs scored',
    );
    expect(picked).toHaveTextContent('Cost per run$0.84');
    expect(
      picked.querySelector('[data-slot="against-live"]'),
    ).toHaveTextContent(
      '72% (52–90%) vs live 56% (36–74%) on the same 18 runs+16 pts(+2 to +30)· Better',
    );
    expect(
      picked.querySelector('[data-slot="cost-against-live"]'),
    ).toHaveTextContent('cost $0.82 vs live $0.60 a run on the same 18 runs');
    expect(picked.querySelector('[data-slot="compared"]')).toHaveTextContent(
      '1 regression over 18 runs compared',
    );
    expect(
      within(picked).getByRole('link', { name: 'Baseline comparison' }),
    ).toHaveAttribute(
      'href',
      `${STATION}/station_implementation/replays/replay_opus_skill`,
    );
    expect(
      within(card('Implementation')).getByText(/Live config, replayed/),
    ).toBeInTheDocument();
  });

  it('keeps the held-out score apart from the search score', async () => {
    showing();

    await userEvent.click(
      within(card('Implementation')).getByRole('button', {
        name: 'Show table',
      }),
    );

    const heldOut = row('opus-with-migrations-skill').querySelector(
      '[data-slot="held-out"]',
    );
    expect(heldOut).toHaveTextContent(
      'Held out67% (33–100%) of 7 held-out runs',
    );
    expect(
      row('sonnet-terse-prompt').querySelector('[data-slot="held-out"]'),
    ).toHaveTextContent('Not held out');
  });

  it('leads to the pull request, the search or the replay, whichever shows the change', async () => {
    showing();

    for (const name of ['Implementation', 'Code Review']) {
      await userEvent.click(
        within(card(name)).getByRole('button', { name: 'Show table' }),
      );
    }

    expect(
      within(row('opus-with-migrations-skill')).getByRole('link', {
        name: 'Pull request',
      }),
    ).toHaveAttribute(
      'href',
      'https://github.com/acme/spotlight-config/pull/42',
    );
    expect(
      within(row('sonnet-terse-prompt')).getByRole('link', {
        name: 'Pick on the search',
      }),
    ).toHaveAttribute(
      'href',
      `${STATION}/station_implementation/searches/search_1#candidate-candidate_terse`,
    );

    const proposed = row('review-against-spec');
    expect(proposed).toHaveTextContent('Proposed');
    expect(proposed).toHaveTextContent('Replay success67% of 12 runs scored');
    expect(proposed.querySelector('[data-slot="held-out"]')).toBeNull();
    expect(proposed.querySelector('[data-slot="compared"]')).toHaveTextContent(
      '2 regressions over 12 runs compared',
    );
    expect(
      within(proposed).getByRole('link', {
        name: 'Its changes and baseline comparison',
      }),
    ).toHaveAttribute(
      'href',
      `${STATION}/station_review/replays/replay_spec_review`,
    );
    expect(
      within(proposed).queryByRole('link', { name: 'Baseline comparison' }),
    ).not.toBeInTheDocument();
  });

  it('leaves out the comparison with live where no task was compared', async () => {
    const [station] = CANDIDATES.stations;
    answer.candidates = held({
      ...CANDIDATES,
      stations: [
        {
          ...station,
          sets: station?.sets.map((set) => ({
            ...set,
            candidates: set.candidates.map((each) => ({
              ...each,
              regressions: 0,
              compared: 0,
            })),
          })),
        },
      ],
    });

    showing();
    await userEvent.click(screen.getByRole('button', { name: 'Show table' }));

    const picked = row('opus-with-migrations-skill');
    expect(picked.querySelector('[data-slot="against-live"]')).toBeNull();
    expect(picked.querySelector('[data-slot="compared"]')).toHaveTextContent(
      'No runs compared yet',
    );
  });

  it('still leads somewhere where the team’s lines have not loaded', () => {
    answer.candidates = held({ ...CANDIDATES, stations: [] });
    answer.lines = undefined;

    showing();

    expect(
      screen.getByRole('link', { name: 'Open the team’s lines' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1');
  });
});
