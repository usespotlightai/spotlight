import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { describe, expect, it } from 'vitest';

const linear = {
  server: 'linear',
  calls: 2,
  failed: 1,
  latency: LatencyHistogram.timing([300, 900]),
  lastCallFailed: true,
};

describe('RunTools', () => {
  it('finds the calls to a server and the skills read', () => {
    const tools = RunTools.of({ servers: [linear], skillsRead: ['grafana'] });

    expect(tools.callsTo('linear')?.calls).toBe(2);
    expect(tools.callsTo('sentry')).toBeNull();
    expect(tools.read('grafana')).toBe(true);
    expect(tools.read('our-migrations')).toBe(false);
  });

  it('rejects calls it cannot account for', () => {
    for (const wrong of [
      {
        ...linear,
        calls: 0,
        failed: 0,
        latency: LatencyHistogram.EMPTY,
        lastCallFailed: false,
      },
      { ...linear, failed: 3 },
      { ...linear, latency: LatencyHistogram.timing([300, 900, 10]) },
      {
        ...linear,
        failed: 0,
        lastCallFailed: false,
        latency: LatencyHistogram.timing([300]),
      },
      { ...linear, failed: 0 },
      { ...linear, server: ' ' },
    ]) {
      expect(() => RunTools.of({ servers: [wrong], skillsRead: [] })).toThrow(
        InvalidOutcomeError,
      );
    }
  });

  it('rejects a server counted twice or a skill without a name', () => {
    expect(() =>
      RunTools.of({ servers: [linear, linear], skillsRead: [] }),
    ).toThrow(InvalidOutcomeError);
    expect(() => RunTools.of({ servers: [], skillsRead: [''] })).toThrow(
      InvalidOutcomeError,
    );
  });
});
