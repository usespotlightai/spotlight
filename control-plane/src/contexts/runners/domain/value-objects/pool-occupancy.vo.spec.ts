import { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { describe, expect, it } from 'vitest';

const IDLE = SandboxId.of('sandbox_1');

describe('PoolOccupancy', () => {
  it('counts an idle sandbox and the runner that enters it as one', () => {
    expect(
      PoolOccupancy.of({ runners: 1, entered: [IDLE], idleSandboxes: [IDLE] })
        .taken,
    ).toBe(1);
  });

  it('counts every runner and every idle sandbox no runner enters', () => {
    expect(
      PoolOccupancy.of({
        runners: 2,
        entered: [SandboxId.of('sandbox_2')],
        idleSandboxes: [IDLE],
      }).taken,
    ).toBe(3);
  });
});
