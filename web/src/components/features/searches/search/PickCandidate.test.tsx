import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PickCandidate } from '@/components/features/searches/search/PickCandidate';
import type { SearchCandidate } from '@/lib/search';

const mutate = vi.fn();

vi.mock('@/hooks/api/usePickSearchCandidate', () => ({
  usePickSearchCandidate: () => ({
    mutate,
    isPending: false,
  }),
}));

const CANDIDATE: SearchCandidate = {
  candidateId: 'candidate_1',
  name: 'tests-first',
  isSeed: false,
  iteration: 1,
  hypothesis: null,
  fingerprint: null,
  changes: [],
  replayId: 'replay_1',
  replayState: 'finished',
  heldOutReplayId: null,
  heldOutReplayState: null,
  searchInterval: null,
  heldOutInterval: null,
  searchedGain: null,
  heldOutGain: null,
  searchedPairs: null,
  heldOutPairs: null,
  searchScore: 0.8,
  searchScored: 5,
  heldOutScore: null,
  costPerRun: 0.9,
  spent: { amount: 4.5, currency: 'USD' },
  onFrontier: true,
  overfit: null,
  regressions: { searched: null, heldOut: null, total: null },
  exceedsRegressionLimit: false,
  pullRequest: null,
};

const renderPick = (candidate: SearchCandidate) =>
  render(
    <PickCandidate teamId="team_1" searchId="search_1" candidate={candidate} />,
  );

describe('PickCandidate', () => {
  beforeEach(() => mutate.mockClear());

  it('picks a candidate whose replay finished', () => {
    renderPick(CANDIDATE);

    fireEvent.click(screen.getByRole('button', { name: 'Open pull request' }));

    expect(mutate).toHaveBeenCalledWith({
      teamId: 'team_1',
      searchId: 'search_1',
      candidateId: 'candidate_1',
    });
  });

  it('lets a likely overfit candidate open a pull request, with no warning beside the button', () => {
    renderPick({ ...CANDIDATE, overfit: 'likely' });

    expect(screen.queryByRole('note')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Open pull request' }),
    ).toBeEnabled();
  });

  it('lets a candidate over the line’s regression limit open a pull request, with no warning beside the button', () => {
    renderPick({
      ...CANDIDATE,
      regressions: { searched: 3, heldOut: null, total: 3 },
      exceedsRegressionLimit: true,
    });

    expect(screen.queryByRole('note')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Open pull request' }),
    ).toBeEnabled();
  });

  it('waits for the candidate’s replay before it may be picked', () => {
    renderPick({ ...CANDIDATE, replayState: 'running' });

    expect(
      screen.getByRole('button', { name: 'Open pull request' }),
    ).toBeDisabled();
  });

  it('offers no pick for the live config', () => {
    const { container } = renderPick({ ...CANDIDATE, isSeed: true });

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the button as opening while a pull request opens', () => {
    renderPick({
      ...CANDIDATE,
      pullRequest: { id: 'p', state: 'opening', url: null, reason: null },
    });

    expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled();
  });

  it('turns the button into a link to the opened pull request', () => {
    renderPick({
      ...CANDIDATE,
      pullRequest: {
        id: 'p',
        state: 'opened',
        url: 'https://github.com/acme/config/pull/42',
        reason: null,
      },
    });

    expect(
      screen.getByRole('link', { name: 'View pull request' }),
    ).toHaveAttribute('href', 'https://github.com/acme/config/pull/42');
  });

  it('shows the opened pull request as unavailable while its link is unknown', () => {
    renderPick({
      ...CANDIDATE,
      pullRequest: { id: 'p', state: 'opened', url: null, reason: null },
    });

    expect(
      screen.getByRole('button', { name: 'View pull request' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Open pull request' }),
    ).toBeNull();
  });

  it('says why a pull request failed, with what to set by hand, and retries', () => {
    renderPick({
      ...CANDIDATE,
      pullRequest: {
        id: 'p',
        state: 'failed',
        url: null,
        reason: {
          code: 'computed-attribute',
          message: 'effort comes from a local',
          attribute: 'effort',
          expression: 'local.effort',
          wanted: 'medium',
        },
      },
    });

    const reason = screen.getByText(
      'Attribute is computed in Terraform. Please set it by hand.',
    );
    expect(reason).toBeInTheDocument();
    expect(screen.getByText('effort comes from a local')).toBeInTheDocument();
    expect(screen.getByText('local.effort')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
