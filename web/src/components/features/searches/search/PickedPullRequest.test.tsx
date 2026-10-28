import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PickedPullRequest } from '@/components/features/searches/search/PickedPullRequest';
import { CONFIG_PULL_REQUESTS } from '@/mocks/world/config-pull-requests';

const URL = CONFIG_PULL_REQUESTS.opened.url;

const shown = (container: HTMLElement) =>
  container.querySelector('[data-slot="picked-pull-request"]') as HTMLElement;

const note = (container: HTMLElement) =>
  container.querySelector(
    '[data-slot="closed-pull-request-note"] [aria-describedby]',
  );

describe('PickedPullRequest', () => {
  it('links an open pull request with no state line', () => {
    const { container } = render(
      <PickedPullRequest pullRequest={CONFIG_PULL_REQUESTS.opened} />,
    );

    expect(
      screen.getByRole('link', { name: 'View pull request' }),
    ).toHaveAttribute('href', URL);
    expect(
      container.querySelector('[data-slot="pull-request-state"]'),
    ).toBeNull();
  });

  it('says Spotlight is closing a pull request, and why on hover', () => {
    const { container } = render(
      <PickedPullRequest pullRequest={CONFIG_PULL_REQUESTS.closing} />,
    );

    expect(
      within(shown(container)).getByText(
        'Spotlight is closing the pull request…',
      ),
    ).toBeInTheDocument();
    expect(note(container)).toHaveAccessibleDescription(
      'The live config of the station changed after the pull request opened.',
    );
    expect(
      screen.getByRole('link', { name: 'View pull request' }),
    ).toHaveAttribute('href', URL);
  });

  it('says a pull request closed because the live config changed, and why on hover', () => {
    const { container } = render(
      <PickedPullRequest pullRequest={CONFIG_PULL_REQUESTS['closed-stale']} />,
    );

    expect(screen.getByText('Pull request closed')).toBeInTheDocument();
    expect(note(container)).toHaveAccessibleDescription(
      'The live config of the station changed after the pull request opened.',
    );
  });

  it('says a pull request closed on GitHub, and on hover that Spotlight does not propose it again', () => {
    const { container } = render(
      <PickedPullRequest
        pullRequest={CONFIG_PULL_REQUESTS['closed-by-person']}
      />,
    );

    expect(screen.getByText('Pull request closed')).toBeInTheDocument();
    expect(note(container)).toHaveAccessibleDescription(
      "The pull request was closed on GitHub. Spotlight does not propose this config again while the station's live config stays the same.",
    );
  });

  it('says on hover why Spotlight could not close a stale pull request on GitHub', () => {
    const { container } = render(
      <PickedPullRequest
        pullRequest={CONFIG_PULL_REQUESTS['closed-close-failure']}
      />,
    );

    expect(note(container)).toHaveAccessibleDescription(
      /Sorry, Spotlight could not close it on GitHub\. Spotlight’s GitHub App cannot access acme\/config\./,
    );
  });

  it('says a pull request merged, with its link', () => {
    render(<PickedPullRequest pullRequest={CONFIG_PULL_REQUESTS.merged} />);

    expect(screen.getByText('Pull request merged')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View pull request' }),
    ).toHaveAttribute('href', URL);
  });
});
