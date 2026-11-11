import { InvalidTerraformStateError } from '@configuration/domain/exceptions/invalid-terraform-state.error';
import type { PrincipalRef } from '@configuration/domain/value-objects/principal-ref.vo';
import { StateLockId } from '@configuration/domain/value-objects/state-lock-id.vo';
import {
  lockOperationOf,
  StateLock,
} from '@configuration/domain/value-objects/state-lock.vo';

type LockBody = Readonly<Record<string, unknown>>;

const bodyOf = (raw: unknown): LockBody => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidTerraformStateError('lock must be a JSON object');
  }

  return raw as LockBody;
};

export const TerraformLockBody = {
  idIn(raw: unknown): StateLockId {
    return StateLockId.of(bodyOf(raw).ID);
  },

  lockOf(raw: unknown, lockedBy: PrincipalRef, lockedAt: Date): StateLock {
    const body = bodyOf(raw);

    return StateLock.of({
      id: StateLockId.of(body.ID),
      operation: lockOperationOf(body.Operation),
      asWritten: body,
      lockedBy,
      lockedAt,
    });
  },
};
