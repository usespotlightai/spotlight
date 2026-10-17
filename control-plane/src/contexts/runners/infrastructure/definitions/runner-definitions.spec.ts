import { RunnerDefinitions } from '@runners/infrastructure/definitions/runner-definitions';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it } from 'vitest';

const definitions = new RunnerDefinitions();

const invalidAt = (
  compiled:
    | { ok: true }
    | { ok: false; problems: readonly ConfigurationProblem[] },
): (string | undefined)[] =>
  compiled.ok ? [] : compiled.problems.map((each) => dottedOf(each.field));

describe('RunnerDefinitions', () => {
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
      invalidAt(
        definitions.trust({
          key: 'Production',
          issuer: 'http://oidc.example.com',
          subject: '',
          labels: ['Not A Label'],
        }),
      ),
    ).toEqual(['key', 'issuer', 'subject', 'labels.0']);
  });

  it('leaves a trust the workspace declares twice for the declaration to reject', () => {
    expect(
      invalidAt(
        definitions.workspaceRunners({ trusts: ['production', 'production'] }),
      ),
    ).toEqual([]);
  });

  it('points at a label a pool is given twice', () => {
    expect(
      invalidAt(definitions.pool({ key: 'ephemeral', labels: ['gpu', 'gpu'] })),
    ).toEqual(['labels.1']);
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
          compiled.access.mode === 'pull' && compiled.access.token?.revealed(),
          compiled.access.mode === 'pull' && compiled.access.tokenVersion,
        ],
      ).toEqual(['ephemeral', ['linux'], 4, 'x'.repeat(40), 2]);
    });

    it('points at a token too short or too strange to be generated', () => {
      expect(
        invalidAt(definitions.pool({ key: 'ephemeral', token: 'hunter2' })),
      ).toEqual(['token']);
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
        invalidAt(
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
        invalidAt(
          definitions.pool({
            key: 'sandboxes',
            maxRuns: 0,
            provision: { url: 'ftp://example.com', secret: 'hunter2' },
          }),
        ),
      ).toEqual(['maxRuns', 'provision.url', 'provision.secret']);
    });
  });

  describe('the egress of a pool', () => {
    const SECRET = `whsec_${Buffer.from('k'.repeat(32)).toString('base64')}`;
    const provisioning = (egress: unknown) =>
      definitions.pool({
        key: 'sandboxes',
        provision: {
          url: 'https://provision.example.com/runs',
          secret: SECRET,
          egress,
        },
      });
    const egressOf = (egress: unknown) => {
      const compiled = provisioning(egress);

      return compiled.ok && compiled.access.mode === 'push'
        ? (compiled.access.egress?.value ?? null)
        : 'invalid';
    };

    it('reads spotlight, the id of an egress, or none', () => {
      expect(egressOf('spotlight')).toBe('spotlight');
      expect(egressOf('egress_1')).toBe('egress_1');
      expect(egressOf(null)).toBeNull();
      expect(egressOf(undefined)).toBeNull();
    });

    it('points at an egress that is not a string, or empty', () => {
      expect(invalidAt(provisioning(7))).toEqual(['provision.egress']);
      expect(invalidAt(provisioning(' '))).toEqual(['provision.egress']);
    });

    const sending = (egress: unknown, egressTraffic: unknown) =>
      definitions.pool({
        key: 'sandboxes',
        provision: {
          url: 'https://provision.example.com/runs',
          secret: SECRET,
          egress,
          egressTraffic,
        },
      });
    const trafficOf = (egress: unknown, egressTraffic: unknown) => {
      const compiled = sending(egress, egressTraffic);

      return compiled.ok && compiled.access.mode === 'push'
        ? compiled.access.egressTraffic.value
        : 'invalid';
    };

    it('sends all traffic through the egress unless the pool says only bound traffic', () => {
      expect(trafficOf('spotlight', undefined)).toBe('all');
      expect(trafficOf('spotlight', 'all')).toBe('all');
      expect(trafficOf('spotlight', 'bound')).toBe('bound');
    });

    it('rejects a traffic setting it does not know, or one with no egress', () => {
      expect(invalidAt(sending('spotlight', 'some'))).toEqual([
        'provision.egressTraffic',
      ]);
      expect(invalidAt(sending(null, 'bound'))).toEqual([
        'provision.egressTraffic',
      ]);
    });
  });

  describe('an egress', () => {
    it('reads its key, URL and token', () => {
      const compiled = definitions.egress({
        key: 'shared',
        url: 'https://egress.example.com',
        token: 'x'.repeat(40),
        tokenVersion: 3,
      });

      expect(
        compiled.ok && [
          compiled.key.value,
          compiled.url.value,
          compiled.token?.revealed(),
          compiled.tokenVersion,
        ],
      ).toEqual(['shared', 'https://egress.example.com', 'x'.repeat(40), 3]);
    });

    it('reads an egress without a token for Spotlight to issue one', () => {
      const compiled = definitions.egress({
        key: 'shared',
        url: 'https://egress.example.com',
      });

      expect(compiled.ok && [compiled.token, compiled.tokenVersion]).toEqual([
        null,
        null,
      ]);
    });

    it('points at each egress field it cannot read', () => {
      expect(
        invalidAt(
          definitions.egress({
            key: 'Shared',
            url: 'egress.example.com',
            token: 'hunter2',
            tokenVersion: -1,
          }),
        ),
      ).toEqual(['key', 'url', 'token', 'tokenVersion']);
    });
  });

  it('reads the pools a declaration names', () => {
    const compiled = definitions.workspaceRunners({ pools: ['ephemeral'] });

    expect(compiled.ok && compiled.pools.map((each) => each.value)).toEqual([
      'ephemeral',
    ]);
  });
});
