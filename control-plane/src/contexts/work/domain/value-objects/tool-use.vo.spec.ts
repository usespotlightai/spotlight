import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { ToolUse } from '@work/domain/value-objects/tool-use.vo';
import { describe, expect, it } from 'vitest';

const linear = {
  server: 'linear',
  calls: 2,
  failed: 1,
  latency: LatencyHistogram.timing([300, 900]),
  lastCallFailed: true,
};

describe('ToolUse', () => {
  it('orders servers and skills by name and reads each skill once', () => {
    const use = ToolUse.of({
      servers: [{ ...linear, server: 'sentry' }, linear],
      skills: ['our-migrations', 'grafana', 'our-migrations'],
    });

    expect(use.servers.map((each) => each.server)).toEqual([
      'linear',
      'sentry',
    ]);
    expect(use.skills).toEqual(['grafana', 'our-migrations']);
  });

  it('refuses more failed calls than calls, or more timed calls than calls', () => {
    expect(() =>
      ToolUse.of({ servers: [{ ...linear, failed: 3 }], skills: [] }),
    ).toThrowError(expect.objectContaining({ violation: 'invalid' }));
    expect(() =>
      ToolUse.of({
        servers: [
          { ...linear, latency: LatencyHistogram.timing([300, 900, 10]) },
        ],
        skills: [],
      }),
    ).toThrowError(expect.objectContaining({ violation: 'invalid' }));
  });

  it('refuses an untimed call that is not counted as failed', () => {
    expect(() =>
      ToolUse.of({
        servers: [
          {
            ...linear,
            failed: 0,
            lastCallFailed: false,
            latency: LatencyHistogram.timing([300]),
          },
        ],
        skills: [],
      }),
    ).toThrowError(expect.objectContaining({ violation: 'invalid' }));
  });

  it('refuses a server broken by a call that never failed', () => {
    expect(() =>
      ToolUse.of({ servers: [{ ...linear, failed: 0 }], skills: [] }),
    ).toThrowError(expect.objectContaining({ violation: 'invalid' }));
  });

  it('refuses counting one server twice', () => {
    expect(() =>
      ToolUse.of({ servers: [linear, linear], skills: [] }),
    ).toThrow();
  });
});
