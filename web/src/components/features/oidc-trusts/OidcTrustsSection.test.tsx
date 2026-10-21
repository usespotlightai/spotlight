import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OidcTrustsSection } from '@/components/features/oidc-trusts/OidcTrustsSection';

const listed = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();
const requested = vi.fn();

vi.mock('@/hooks/api/useOidcTrusts', () => ({
  useOidcTrusts: (slug: string | undefined) => {
    requested(slug);

    return {
      data: listed(),
      isPending: listed() === undefined,
      errorUpdateCount: failing() ? 1 : 0,
      isFetching: false,
      refetch,
    };
  },
}));

const trust = (over: Record<string, unknown> = {}) => ({
  id: 'trust_1',
  key: 'infra-apply',
  issuer: 'https://token.actions.githubusercontent.com',
  audience: 'spotlight',
  subject: 'repo:acme/infra:ref:refs/heads/main',
  claims: { workflow: 'apply' },
  scopes: ['configure', 'secrets'],
  lifetimeMinutes: 60,
  createdBy: { id: 'user_1', name: 'Ada Lovelace' },
  createdAt: '2026-09-01T09:00:00.000Z',
  lastIssuedAt: new Date().toISOString(),
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <OidcTrustsSection slug="acme" />
    </MemoryRouter>,
  );

describe('OidcTrustsSection', () => {
  beforeEach(() => {
    listed.mockReturnValue([]);
    failing.mockReturnValue(false);
    for (const each of [refetch, requested]) {
      each.mockClear();
    }
  });

  it('keeps the shape of a trust while they load', () => {
    listed.mockReturnValue(undefined);

    renderPage();

    expect(
      screen.getByRole('status', { name: 'Loading the OIDC trusts' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'OIDC trusts' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No OIDC trusts/)).not.toBeInTheDocument();
  });

  it('says the trusts could not be loaded, and tries again on request', async () => {
    const person = userEvent.setup();
    listed.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'OIDC trusts could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('says there are no trusts, links to the Terraform guide, and offers no way to create one', () => {
    renderPage();

    expect(
      screen.getByText('No OIDC trusts. Define them with Terraform.'),
    ).toBeInTheDocument();
    const guide = screen.getByRole('link', {
      name: 'Run Terraform from GitHub Actions',
    });
    expect(guide).toHaveAttribute(
      'href',
      'https://docs.usespotlight.ai/docs/configuration/run-terraform-from-github-actions',
    );
    expect(guide).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('counts the trusts, and says of each what it admits, its scopes and when it last issued a token', () => {
    listed.mockReturnValue([
      trust(),
      trust({
        id: 'trust_2',
        key: 'infra-plan',
        subject: 'repo:acme/infra:pull_request',
        scopes: ['plan'],
        lastIssuedAt: null,
      }),
    ]);

    renderPage();

    expect(
      screen.getByRole('heading', { level: 2, name: /^OIDC trusts\s*2$/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('infra-apply')).toBeInTheDocument();
    expect(
      screen.getByText(
        'GitHub Actions in acme/infra, branch main · Configure, Secrets',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Issued just now')).toBeInTheDocument();
    expect(
      screen.getByText('GitHub Actions in acme/infra, pull requests · Plan'),
    ).toBeInTheDocument();
    expect(screen.getByText('Never issued a token')).toBeInTheDocument();
  });

  it('puts the creator, the issuer, the subject, the claims and the token lifetime in the tooltip', () => {
    listed.mockReturnValue([
      trust(),
      trust({
        id: 'trust_2',
        key: 'production-release',
        createdBy: { id: 'user_9', name: null },
        claims: {},
        lastIssuedAt: null,
      }),
    ]);

    renderPage();

    const issued = screen.getByText('Issued just now').closest('span');
    expect(issued).toHaveAccessibleDescription(
      expect.stringMatching(
        /^Created by Ada Lovelace\. Its tokens act for this person\. Created: .+\. Last issued: .+\. Issuer: https:\/\/token\.actions\.githubusercontent\.com\. Subject: repo:acme\/infra:ref:refs\/heads\/main\. Claim workflow: apply\. Token lifetime: 60 minutes\.$/,
      ),
    );
    expect(
      screen.getByText('Never issued a token'),
    ).toHaveAccessibleDescription(
      expect.stringMatching(
        /^Created by a deleted account\. Its tokens act for that account\. Created: .+\. Issuer: https:\/\/token\.actions\.githubusercontent\.com\. Subject: repo:acme\/infra:ref:refs\/heads\/main\. Token lifetime: 60 minutes\.$/,
      ),
    );
  });
});
