import {
  anEgress,
  EGRESS_ID,
} from '@runners/domain/aggregates/egress.fake-spec';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import { validateEgress } from '@runners/domain/services/egress-naming';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const problemOf = (
  reference: EgressReference | null,
  input: Partial<Parameters<typeof validateEgress>[1]> = {},
): string | null => {
  try {
    validateEgress(reference, {
      workspaceId: WORKSPACE,
      named: null,
      platformStored: false,
      ...input,
    });

    return null;
  } catch (error) {
    return error instanceof InvalidRunnerPoolError
      ? `${error.field} ${error.because}`
      : String(error);
  }
};

describe('validateEgress', () => {
  it('lets a pool name no egress', () => {
    expect(problemOf(null)).toBeNull();
  });

  it('lets a pool name the platform egress only where the deployment has one', () => {
    expect(
      problemOf(EgressReference.platform(), { platformStored: true }),
    ).toBeNull();
    expect(problemOf(EgressReference.platform())).toMatch(
      /^provision\.egress names spotlight\. This deployment has no platform egress/,
    );
  });

  it('lets a pool name an egress of its own workspace', () => {
    expect(
      problemOf(EgressReference.to(EGRESS_ID), { named: anEgress() }),
    ).toBeNull();
  });

  it('rejects an egress that is not there, deleted, of another workspace, or another than the one named', () => {
    const reference = EgressReference.to(EGRESS_ID);
    const reason =
      "provision.egress names egress_1. Egress egress_1 doesn't exist in this workspace";

    expect(problemOf(reference)).toBe(reason);
    expect(
      problemOf(reference, { named: anEgress().delete([], attributedIn()) }),
    ).toBe(reason);
    expect(
      problemOf(reference, {
        named: anEgress({ workspaceId: WorkspaceId.of('ws_other') }),
      }),
    ).toBe(reason);
    expect(
      problemOf(reference, {
        named: anEgress({ id: EgressId.of('egress_2') }),
      }),
    ).toBe(reason);
  });
});
