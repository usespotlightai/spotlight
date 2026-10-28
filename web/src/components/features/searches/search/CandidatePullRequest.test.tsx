import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CandidatePullRequest } from '@/components/features/searches/search/CandidatePullRequest';
import { CONFIG_PULL_REQUESTS } from '@/mocks/world/config-pull-requests';

const URL = CONFIG_PULL_REQUESTS.opened.url;

const note = (container: HTMLElement) =>
  container.querySelector(
    '[data-slot="closed-pull-request-note"] [aria-describedby]',
  );

describe('CandidatePullRequest', () => {
  it('links an open pull request with no note', () => {
    const { container } = render(
      <CandidatePullRequest pullRequest={CONFIG_PULL_REQUESTS.opened} />,
    );

    expect(screen.getByRole('link', { name: 'Opened' })).toHaveAttribute(
      'href',
      URL,
    );
    expect(note(container)).toBeNull();
  });

  it('links a pull request Spotlight is closing, saying why on hover', () => {
    const { container } = render(
      <CandidatePullRequest pullRequest={CONFIG_PULL_REQUESTS.closing} />,
    );

    expect(screen.getByRole('link', { name: 'Closing…' })).toHaveAttribute(
      'href',
      URL,
    );
    expect(note(container)).toHaveAccessibleDescription(
      'The live config of the station changed after the pull request opened.',
    );
  });

  it('links a pull request closed because the live config changed, saying why on hover', () => {
    const { container } = render(
      <CandidatePullRequest
        pullRequest={CONFIG_PULL_REQUESTS['closed-stale']}
      />,
    );

    expect(screen.getByRole('link', { name: 'Closed' })).toHaveAttribute(
      'href',
      URL,
    );
    expect(note(container)).toHaveAccessibleDescription(
      'The live config of the station changed after the pull request opened.',
    );
  });

  it('links a pull request closed on GitHub, saying on hover that Spotlight does not propose it again', () => {
    const { container } = render(
      <CandidatePullRequest
        pullRequest={CONFIG_PULL_REQUESTS['closed-by-person']}
      />,
    );

    expect(screen.getByRole('link', { name: 'Closed' })).toBeInTheDocument();
    expect(note(container)).toHaveAccessibleDescription(
      "The pull request was closed on GitHub. Spotlight does not propose this config again while the station's live config stays the same.",
    );
  });

  it('says on hover why Spotlight could not close a stale pull request on GitHub', () => {
    const { container } = render(
      <CandidatePullRequest
        pullRequest={CONFIG_PULL_REQUESTS['closed-close-failure']}
      />,
    );

    expect(note(container)).toHaveAccessibleDescription(
      'The live config of the station changed after the pull request opened. Sorry, Spotlight could not close it on GitHub. Spotlight’s GitHub App cannot access acme/config. Please install it on the repository.',
    );
  });

  it('links a merged pull request with no note', () => {
    const { container } = render(
      <CandidatePullRequest pullRequest={CONFIG_PULL_REQUESTS.merged} />,
    );

    expect(screen.getByRole('link', { name: 'Merged' })).toBeInTheDocument();
    expect(note(container)).toBeNull();
  });
});
