import { logContext } from '@platform/logging/log-context';
import {
  attributesOf,
  OtelTelemetry,
} from '@platform/telemetry/otel-telemetry';
import { describe, expect, it } from 'vitest';

describe('OtelTelemetry', () => {
  it('names span attributes in the spotlight namespace', () => {
    expect(
      attributesOf({ workspaceId: 'w-1', runId: 'r-1', taskId: undefined }),
    ).toEqual({ 'spotlight.workspace_id': 'w-1', 'spotlight.run_id': 'r-1' });
  });

  it('gives every log line of the work the ids of its span', async () => {
    const seen = await new OtelTelemetry().inSpan(
      'Judging runs',
      { runId: 'r-1', taskId: undefined },
      async () => logContext(),
    );

    expect(seen).toEqual({ runId: 'r-1' });
    expect(logContext()).toEqual({});
  });

  it('keeps the ids of the work around it', async () => {
    const spans = new OtelTelemetry();

    const seen = await spans.inSpan('outer', { teamId: 't-1' }, () =>
      spans.inSpan('inner', { runId: 'r-1' }, async () => logContext()),
    );

    expect(seen).toEqual({ teamId: 't-1', runId: 'r-1' });
  });

  it('rethrows what the work throws', async () => {
    const failure = new Error('judge is down');

    await expect(
      new OtelTelemetry().inSpan('Judging runs', {}, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});
