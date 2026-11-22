import { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import { describe, expect, it } from 'vitest';

describe('why an assist session gave nothing back', () => {
  it('lasts where no harness can run it or its run is in another workspace', () => {
    expect(SessionFailure.of('no-harness').lasting).toBe(true);
    expect(SessionFailure.of('base-run-elsewhere').lasting).toBe(true);
  });

  it('may pass where the run failed or submitted no usable result', () => {
    expect(SessionFailure.of('run-failed').lasting).toBe(false);
    expect(SessionFailure.of('no-result').lasting).toBe(false);
  });
});
