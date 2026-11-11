import { describe, expect, it } from 'vitest';

import { describeIssued, type OidcTrust, trustNote } from '@/lib/oidc-trust';

const GITHUB_ACTIONS_ISSUER = 'https://token.actions.githubusercontent.com';

const trust = (over: Partial<OidcTrust> = {}): OidcTrust => ({
  id: 'trust_1',
  key: 'infra-apply',
  issuer: GITHUB_ACTIONS_ISSUER,
  audience: 'spotlight',
  subject: 'repo:acme/infra:ref:refs/heads/main',
  claims: {},
  scopes: ['configure', 'secrets'],
  lifetimeMinutes: 60,
  description: '',
  createdBy: { id: 'user_1', name: 'Ada Lovelace' },
  createdAt: '2026-09-01T09:00:00.000Z',
  lastIssuedAt: null,
  ...over,
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
