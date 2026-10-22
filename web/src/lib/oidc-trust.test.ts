import { describe, expect, it } from 'vitest';
import {
  admitted,
  describeIssued,
  describeTrust,
  GITHUB_ACTIONS_ISSUER,
  type OidcTrust,
  trustNote,
} from '@/lib/oidc-trust';

const github = (subject: string) =>
  admitted({ issuer: GITHUB_ACTIONS_ISSUER, subject });

const trust = (over: Partial<OidcTrust> = {}): OidcTrust => ({
  id: 'trust_1',
  key: 'infra-apply',
  issuer: GITHUB_ACTIONS_ISSUER,
  audience: 'spotlight',
  subject: 'repo:acme/infra:ref:refs/heads/main',
  claims: {},
  scopes: ['configure', 'secrets'],
  lifetimeMinutes: 60,
  createdBy: { id: 'user_1', name: 'Ada Lovelace' },
  createdAt: '2026-09-01T09:00:00.000Z',
  lastIssuedAt: null,
  ...over,
});

describe('admitted', () => {
  it('names the repository and the branch of a GitHub Actions subject', () => {
    expect(github('repo:acme/infra:ref:refs/heads/main')).toBe(
      'GitHub Actions in acme/infra, branch main',
    );
    expect(github('repo:acme/infra:ref:refs/heads/release/v2')).toBe(
      'GitHub Actions in acme/infra, branch release/v2',
    );
  });

  it('names pull requests, environments and tags', () => {
    expect(github('repo:acme/infra:pull_request')).toBe(
      'GitHub Actions in acme/infra, pull requests',
    );
    expect(github('repo:acme/web:environment:production')).toBe(
      'GitHub Actions in acme/web, environment production',
    );
    expect(github('repo:acme/web:ref:refs/tags/v1.2.0')).toBe(
      'GitHub Actions in acme/web, tag v1.2.0',
    );
  });

  it('shows any other GitHub Actions subject as it is, patterns included', () => {
    expect(github('repo:acme/*:ref:refs/heads/main')).toBe(
      'GitHub Actions: repo:acme/*:ref:refs/heads/main',
    );
    expect(github('repo:acme/infra:ref:refs/heads/*')).toBe(
      'GitHub Actions: repo:acme/infra:ref:refs/heads/*',
    );
    expect(github('repo:acme/infra:workflow:deploy')).toBe(
      'GitHub Actions: repo:acme/infra:workflow:deploy',
    );
    expect(
      github(
        'repo:acme/infra:ref:refs/heads/main:job_workflow_ref:acme/infra/.github/workflows/x.yml@refs/heads/main',
      ),
    ).toBe(
      'GitHub Actions: repo:acme/infra:ref:refs/heads/main:job_workflow_ref:acme/infra/.github/workflows/x.yml@refs/heads/main',
    );
  });

  it('names the host of any other issuer beside the subject', () => {
    expect(
      admitted({
        issuer: 'https://agent.buildkite.com',
        subject: 'organization:acme:pipeline:deploys',
      }),
    ).toBe('agent.buildkite.com: organization:acme:pipeline:deploys');
    expect(admitted({ issuer: 'not a url', subject: 'ci' })).toBe(
      'not a url: ci',
    );
  });
});

describe('describeTrust', () => {
  it('says what the trust admits, then the scopes of its tokens', () => {
    expect(describeTrust(trust())).toBe(
      'GitHub Actions in acme/infra, branch main · Configure, Secrets',
    );
  });
});

describe('describeIssued', () => {
  it('says a trust never issued a token', () => {
    expect(describeIssued(null)).toBe('Never issued a token');
  });

  it('says when a trust last issued a token', () => {
    expect(describeIssued(new Date().toISOString())).toBe('Issued just now');
  });
});

describe('trustNote', () => {
  it('names the creator, the issuer, the subject, the claims and the token lifetime', () => {
    const note = trustNote(
      trust({ claims: { workflow: 'apply' }, lifetimeMinutes: 30 }),
    );

    expect(note.title).toBe('Created by Ada Lovelace');
    expect(note.rows).toEqual([
      ['Created', expect.stringContaining('2026')],
      ['Issuer', GITHUB_ACTIONS_ISSUER],
      ['Subject', 'repo:acme/infra:ref:refs/heads/main'],
      ['Claim workflow', 'apply'],
      ['Token lifetime', '30 minutes'],
    ]);
  });

  it('names a deleted account, and leaves out a last issue that never happened', () => {
    const note = trustNote(
      trust({
        createdBy: { id: 'user_9', name: null },
        lastIssuedAt: null,
      }),
    );

    expect(note.title).toBe('Created by a deleted account');
    expect(note.body).toBe('Its tokens act for that account.');
    expect(note.rows?.map(([label]) => label)).toEqual([
      'Created',
      'Issuer',
      'Subject',
      'Token lifetime',
    ]);
  });
});
