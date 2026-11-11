import type { WarmSandboxesPort } from '@runners/application/ports/warm-sandboxes.port';
import { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import {
  checkoutOf,
  warmLineOf,
} from '@runs/domain/value-objects/warm-line.fake-spec';
import { RunnersWarmSandboxKeeping } from '@runs/infrastructure/acl/runners-warm-sandboxes.adapter';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-08T12:00:00.000Z');

describe('RunnersWarmSandboxKeeping', () => {
  it('orders a warm sandbox that checks out each repository of the line where a run checks it out, with its setup', async () => {
    const request = vi.fn(async () => {});
    const keeping = new RunnersWarmSandboxKeeping({
      request,
    } as unknown as WarmSandboxesPort);
    const line = warmLineOf({
      checkouts: [checkoutOf('widgets', 'npm ci'), checkoutOf('api')],
      placement: RunnerPlacement.of(['gpu']),
    });

    await keeping.request(
      { line, fingerprint: WarmFingerprint.ofSetup(line) },
      NOW,
    );

    expect(request).toHaveBeenCalledWith(
      {
        workspaceId: 'ws_1',
        lineId: 'line_1',
        placement: { labelGroups: [['gpu']], image: null },
        checkouts: [
          { path: 'widgets', setup: 'npm ci' },
          { path: 'api', setup: null },
        ],
        fingerprint: WarmFingerprint.ofSetup(line).value,
      },
      NOW,
    );
  });
});
