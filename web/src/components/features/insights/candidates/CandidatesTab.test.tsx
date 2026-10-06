import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidatesTab } from '@/components/features/insights/candidates/CandidatesTab';
import type { InsightsPeriod } from '@/lib/insights';
import { stationNamesOf } from '@/lib/insights';
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

const answer: {
  candidates: Held;
  lines: unknown;
  asked: unknown[];
} = {
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
  it('asks for the candidates replayed in its period', () => {
    showing('7d');

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
      screen.getByText(/Replay a station’s past tasks under a changed config/),
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
      'Only the latest replays in this period are counted',
    );
  });

  it('gives each station a card, with each replay set and how far to trust it', () => {
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
      implementation.querySelector('[data-slot="replay-set-health"]'),
    ).toHaveTextContent('24 tasks (27 runs)');
    expect(
      within(implementation).getByLabelText('Checks pull requests'),
    ).toBeInTheDocument();
    expect(
      within(card('Code Review')).queryByLabelText('Checks pull requests'),
    ).not.toBeInTheDocument();
    expect(
      within(implementation).getByLabelText('How far to trust this set'),
    ).toBeInTheDocument();
  });

  it('lists each candidate with what changed, its success and cost beside live', () => {
    showing();

    const picked = row('opus-with-migrations-skill');
    expect(picked).toHaveTextContent(
      'Model sonnet → opus, Skill our-migrations added',
    );
    expect(picked).toHaveTextContent('SourceSearch · best value');
    expect(picked).toHaveTextContent('Candidate72%Live56%');
    expect(picked).toHaveTextContent('Against live+16 ptsBetter');
    expect(picked).toHaveTextContent('Cost per run$0.82Live cost$0.60');
    expect(picked).toHaveTextContent('Runs18');
    expect(row('sonnet-plan-first')).toHaveTextContent(
      'RunningSame as the live config',
    );
    expect(
      within(card('Implementation'))
        .getByText('Live config')
        .closest('[data-slot="replayed-baseline"]'),
    ).toHaveTextContent('Live54%Cost per run–Live cost$0.62Runs24View replay');
  });

  it('shows the held-out score only where the set held tasks out', () => {
    showing();

    expect(row('opus-with-migrations-skill')).toHaveTextContent('Held out67%');
    expect(row('sonnet-terse-prompt')).toHaveTextContent('Held out–');
    expect(row('review-against-spec')).not.toHaveTextContent('Held out');
  });

  it('leads to the pull request, the search or the replay, whichever shows the change', () => {
    showing();

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
    expect(proposed).toHaveTextContent('SourceProposed');
    expect(
      within(proposed).getByRole('link', { name: 'View changes' }),
    ).toHaveAttribute(
      'href',
      `${STATION}/station_review/replays/replay_spec_review`,
    );
  });

  it('says a candidate was not compared with live where no task was compared', () => {
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
    answer.candidates = held({ ...CANDIDATES, stations: [] });
    answer.lines = undefined;

    showing();

    expect(
      screen.getByRole('link', { name: 'Open the team’s lines' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1');
  });
});
