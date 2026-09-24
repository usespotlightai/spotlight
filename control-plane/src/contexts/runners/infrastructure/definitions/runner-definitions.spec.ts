import { RunnerDefinitions } from '@runners/infrastructure/definitions/runner-definitions';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it } from 'vitest';

const definitions = new RunnerDefinitions();

const refusedAt = (
  compiled:
    | { ok: true }
    | { ok: false; problems: readonly ConfigurationProblem[] },
): (string | undefined)[] =>
  compiled.ok ? [] : compiled.problems.map((each) => dottedOf(each.field));

describe('RunnerDefinitions', () => {
  it('reads a runner as its name, labels and any token it was given', () => {
    const compiled = definitions.runner({
      name: 'build-1',
      labels: ['vpc-internal'],
      token: 'x'.repeat(40),
    });

    expect(
      compiled.ok && [
        compiled.name.value,
        compiled.labels.values,
        compiled.token,
      ],
    ).toEqual(['build-1', ['vpc-internal'], 'x'.repeat(40)]);
  });

  it('reads a runner given no token as one Spotlight issues it', () => {
    const compiled = definitions.runner({ name: 'build-1' });

    expect(compiled.ok && compiled.token).toBeNull();
  });

  it('points at a token too short to be one, and a label given twice', () => {
    expect(
      refusedAt(
        definitions.runner({
          name: 'build-1',
          labels: ['gpu', 'gpu'],
          token: 'short',
        }),
      ),
    ).toEqual(['labels.1', 'token']);
  });

  it('reads a trust, taking spotlight as the audience it was not given', () => {
    const compiled = definitions.trust({
      key: 'production',
      issuer: 'https://oidc.example.com',
      subject: 'system:serviceaccount:spotlight:runner',
    });

    expect(compiled.ok && compiled.workload.audience).toBe('spotlight');
  });

  it('points at each trust field it cannot read', () => {
    expect(
      refusedAt(
        definitions.trust({
          key: 'Production',
          issuer: 'http://oidc.example.com',
          subject: '',
          labels: ['Not A Label'],
        }),
      ),
    ).toEqual(['key', 'issuer', 'subject', 'labels.0']);
  });

  it('points at a runner the workspace declares twice', () => {
    expect(
      refusedAt(
        definitions.workspaceRunners({ runners: ['build-1', 'build-1'] }),
      ),
    ).toEqual(['runners.1']);
  });

  describe('a pool', () => {
    const SECRET = `whsec_${Buffer.from('k'.repeat(32)).toString('base64')}`;

    it('reads a pool without provision as pulled from with a token', () => {
      const compiled = definitions.pool({
        key: 'ephemeral',
        labels: ['linux'],
        maxRuns: 4,
        token: 'x'.repeat(40),
        tokenVersion: 2,
      });

      expect(
        compiled.ok && [
          compiled.key.value,
          compiled.labels.values,
          compiled.maxRuns?.value,
          compiled.access,
        ],
      ).toEqual([
        'ephemeral',
        ['linux'],
        4,
        { mode: 'pull', token: 'x'.repeat(40), tokenVersion: 2 },
      ]);
    });

    it('reads a pool with provision as pushed to, with its signing secret', () => {
      const compiled = definitions.pool({
        key: 'sandboxes',
        provision: {
          url: 'https://provision.example.com/runs',
          secret: SECRET,
          secretVersion: 1,
        },
      });

      expect(compiled.ok && compiled.access.mode).toBe('push');
      expect(
        compiled.ok &&
          compiled.access.mode === 'push' &&
          compiled.access.secret?.revealed(),
      ).toBe(SECRET);
      expect(compiled.ok && compiled.maxRuns).toBeNull();
    });

    it('gives a pool that provisions no token', () => {
      expect(
        refusedAt(
          definitions.pool({
            key: 'sandboxes',
            token: 'x'.repeat(40),
            tokenVersion: 1,
            provision: { url: 'https://provision.example.com/runs' },
          }),
        ),
      ).toEqual(['token', 'tokenVersion']);
    });

    it('points at a secret not in the Standard Webhooks shape, a URL it cannot call and a limit of no runs', () => {
      expect(
        refusedAt(
          definitions.pool({
            key: 'sandboxes',
            maxRuns: 0,
            provision: { url: 'ftp://example.com', secret: 'hunter2' },
          }),
        ),
      ).toEqual(['maxRuns', 'provision.url', 'provision.secret']);
    });
  });

  it('reads the pools a declaration names', () => {
    const compiled = definitions.workspaceRunners({ pools: ['ephemeral'] });

    expect(compiled.ok && compiled.pools.map((each) => each.value)).toEqual([
      'ephemeral',
    ]);
  });
});
