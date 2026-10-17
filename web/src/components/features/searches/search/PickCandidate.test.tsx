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
  seed: false,
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
  onlyOnSeenTasks: null,
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

    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));

    expect(mutate).toHaveBeenCalledWith({
      teamId: 'team_1',
      searchId: 'search_1',
      candidateId: 'candidate_1',
    });
  });

  it('warns before picking a candidate that gained only on the tasks the search could see, and still lets it be picked', () => {
    renderPick({ ...CANDIDATE, onlyOnSeenTasks: 'marked' });

    expect(screen.getByRole('note')).toHaveTextContent(
      'The gain showed only on searched tasks.',
    );
    expect(screen.getByRole('button', { name: 'Pick' })).toBeEnabled();
  });

  it('waits for the candidate’s replay before it may be picked', () => {
    renderPick({ ...CANDIDATE, replayState: 'running' });

    expect(screen.getByRole('button', { name: 'Pick' })).toBeDisabled();
  });

  it('offers no pick for the live config', () => {
    const { container } = renderPick({ ...CANDIDATE, seed: true });

    expect(container).toBeEmptyDOMElement();
  });

  it('says a pull request is opening', () => {
    renderPick({
      ...CANDIDATE,
      pullRequest: { id: 'p', state: 'opening', url: null, reason: null },
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Opening a pull request…',
    );
  });

  it('links the opened pull request', () => {
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
      screen.getByRole('link', { name: 'Pull request opened' }),
    ).toHaveAttribute('href', 'https://github.com/acme/config/pull/42');
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
