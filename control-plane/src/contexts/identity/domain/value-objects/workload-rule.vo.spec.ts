import { InvalidTokenTrustError } from '@identity/domain/exceptions/invalid-token-trust.error';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';
import { describe, expect, it } from 'vitest';

const GITHUB = 'https://token.actions.githubusercontent.com';

const rule = (
  over: Partial<{
    issuer: string;
    audience: string;
    subject: string;
    claims: Record<string, string>;
  }> = {},
) =>
  WorkloadRule.of({
    issuer: GITHUB,
    audience: 'spotlight',
    subject: 'repo:acme/platform:ref:refs/heads/main',
    claims: {},
    ...over,
  });

const workload = (over: Partial<WorkloadClaims> = {}): WorkloadClaims => ({
  issuer: GITHUB,
  subject: 'repo:acme/platform:ref:refs/heads/main',
  audiences: ['spotlight'],
  named: {
    repository: 'acme/platform',
    ref: 'refs/heads/main',
    environment: 'production',
  },
  ...over,
});

describe('WorkloadRule', () => {
  it('admits a workload from its issuer, for its audience, with its subject', () => {
    expect(rule().admits(workload())).toBe(true);
  });

  it('admits nothing another issuer signed, or signed for another audience', () => {
    expect(rule().admits(workload({ issuer: 'https://gitlab.com' }))).toBe(
      false,
    );
    expect(rule().admits(workload({ audiences: ['sts.amazonaws.com'] }))).toBe(
      false,
    );
  });

  it('lets * match any run of characters', () => {
    const everyBranch = rule({
      subject: 'repo:acme/platform:ref:refs/heads/*',
    });

    expect(everyBranch.admits(workload())).toBe(true);
    expect(
      everyBranch.admits(
        workload({ subject: 'repo:acme/platform:ref:refs/heads/release/1' }),
      ),
    ).toBe(true);
    expect(
      everyBranch.admits(
        workload({ subject: 'repo:acme/platform:pull_request' }),
      ),
    ).toBe(false);
    expect(
      rule({ subject: 'repo:acme/*' }).admits(
        workload({ subject: 'repo:acme/api:environment:production' }),
      ),
    ).toBe(true);
  });

  it('treats every other character in a pattern as itself', () => {
    expect(
      rule({ subject: 'repo:acme/platform.io:ref:refs/heads/main' }).admits(
        workload({ subject: 'repo:acme/platformxio:ref:refs/heads/main' }),
      ),
    ).toBe(false);
  });

  it('asks every claim it names to be carried and to match', () => {
    const production = rule({
      subject: 'repo:acme/platform:environment:*',
      claims: { environment: 'production', ref: 'refs/heads/*' },
    });

    expect(
      production.admits(
        workload({ subject: 'repo:acme/platform:environment:production' }),
      ),
    ).toBe(true);
    expect(
      production.admits(
        workload({
          subject: 'repo:acme/platform:environment:staging',
          named: { environment: 'staging', ref: 'refs/heads/main' },
        }),
      ),
    ).toBe(false);
    expect(
      production.admits(
        workload({
          subject: 'repo:acme/platform:environment:production',
          named: { environment: 'production' },
        }),
      ),
    ).toBe(false);
  });

  it('finds no claim among what every object inherits', () => {
    expect(
      rule({ claims: { constructor: '*' } }).admits(workload({ named: {} })),
    ).toBe(false);
  });

  it('rejects a subject that would admit every owner its issuer signs for', () => {
    for (const open of ['*', '**', 'repo:*', '*:*', 'repo:ac*/platform:*']) {
      expect(() => rule({ subject: open })).toThrow(InvalidTokenTrustError);
    }
    expect(() =>
      rule({ subject: '*', claims: { repository: 'acme/platform' } }),
    ).toThrow(InvalidTokenTrustError);
    expect(rule({ subject: 'repo:acme/*' }).subject.value).toBe('repo:acme/*');
    expect(
      rule({ subject: 'repository_owner_id:42:repository_id:7' }).subject.value,
    ).toBe('repository_owner_id:42:repository_id:7');
  });

  it('matches wildcards without backtracking through the claim at every *', () => {
    const many = rule({ subject: `repo:acme/${'*a'.repeat(100)}b` });
    const started = Date.now();

    expect(
      many.admits(workload({ subject: `repo:acme/${'a'.repeat(250)}` })),
    ).toBe(false);
    expect(Date.now() - started).toBeLessThan(200);
    expect(
      rule({ subject: 'repo:acme/*:ref:*/main' }).admits(
        workload({ subject: 'repo:acme/api:ref:refs/heads/main' }),
      ),
    ).toBe(true);
    expect(
      rule({ subject: 'repo:acme/*:ref:*/main' }).admits(
        workload({ subject: 'repo:acme/api:ref:refs/heads/maint' }),
      ),
    ).toBe(false);
  });

  it('rejects claims the token already answers for, or that are not claim names', () => {
    expect(() => rule({ claims: { sub: 'x' } })).toThrow(
      InvalidTokenTrustError,
    );
    expect(() => rule({ claims: { 'job-workflow': 'x' } })).toThrow(
      InvalidTokenTrustError,
    );
  });

  it('rejects an issuer that is not https, save on this machine', () => {
    expect(() => rule({ issuer: 'http://issuer.example' })).toThrow(
      InvalidTokenTrustError,
    );
    expect(() => rule({ issuer: `${GITHUB}?x=1` })).toThrow(
      InvalidTokenTrustError,
    );
    expect(rule({ issuer: 'http://127.0.0.1:8080' }).issuer).toBe(
      'http://127.0.0.1:8080',
    );
  });

  it('is equal to a rule naming the same claims in another order', () => {
    expect(
      rule({ claims: { ref: 'a', repository: 'b' } }).equals(
        rule({ claims: { repository: 'b', ref: 'a' } }),
      ),
    ).toBe(true);
    expect(
      rule({ claims: { ref: 'a' } }).equals(rule({ claims: { ref: 'b' } })),
    ).toBe(false);
  });
});
