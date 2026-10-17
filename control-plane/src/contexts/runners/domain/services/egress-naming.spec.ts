import {
  anEgress,
  EGRESS_ID,
} from '@runners/domain/aggregates/egress.fake-spec';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import { refuseUnfitEgress } from '@runners/domain/services/egress-naming';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const refused = (
  reference: EgressReference | null,
  input: Partial<Parameters<typeof refuseUnfitEgress>[1]> = {},
): string | null => {
  try {
    refuseUnfitEgress(reference, {
      workspaceId: WORKSPACE,
      named: null,
      platformKept: false,
      ...input,
    });

    return null;
  } catch (error) {
    return error instanceof InvalidRunnerPoolError
      ? `${error.field} ${error.because}`
      : String(error);
  }
};

describe('refuseUnfitEgress', () => {
  it('lets a pool name no egress', () => {
    expect(refused(null)).toBeNull();
  });

  it('lets a pool name the platform egress only where the deployment has one', () => {
    expect(
      refused(EgressReference.platform(), { platformKept: true }),
    ).toBeNull();
    expect(refused(EgressReference.platform())).toMatch(
      /^provision\.egress names spotlight\. This deployment has no platform egress/,
    );
  });

  it('lets a pool name an egress of its own workspace', () => {
    expect(
      refused(EgressReference.to(EGRESS_ID), { named: anEgress() }),
    ).toBeNull();
  });

  it('refuses an egress that is not there, retired, of another workspace, or another than the one named', () => {
    const reference = EgressReference.to(EGRESS_ID);
    const reason =
      "provision.egress names egress_1. Egress egress_1 doesn't exist in this workspace";

    expect(refused(reference)).toBe(reason);
    expect(
      refused(reference, { named: anEgress().retire([], attributedIn()) }),
    ).toBe(reason);
    expect(
      refused(reference, {
        named: anEgress({ workspaceId: WorkspaceId.of('ws_other') }),
      }),
    ).toBe(reason);
    expect(
      refused(reference, {
        named: anEgress({ id: EgressId.of('egress_2') }),
      }),
    ).toBe(reason);
  });
});
