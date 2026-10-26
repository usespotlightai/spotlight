import { InvalidTerraformStateError } from '@configuration/domain/exceptions/invalid-terraform-state.error';

const MAX_LOCK_ID_LENGTH = 256;

export type LockInfo = Readonly<Record<string, unknown>>;

export class StateLock {
  private constructor(
    readonly id: string,
    readonly info: LockInfo,
    readonly lockedBy: string,
    readonly lockedAt: Date,
  ) {}

  static of(input: {
    info: unknown;
    lockedBy: string;
    lockedAt: Date;
  }): StateLock {
    return new StateLock(
      StateLock.idIn(input.info),
      input.info as LockInfo,
      input.lockedBy,
      input.lockedAt,
    );
  }

  static idIn(info: unknown): string {
    if (typeof info !== 'object' || info === null || Array.isArray(info)) {
      throw new InvalidTerraformStateError('lock must be a JSON object');
    }

    const id = (info as LockInfo).ID;

    if (
      typeof id !== 'string' ||
      id.trim().length === 0 ||
      id.length > MAX_LOCK_ID_LENGTH
    ) {
      throw new InvalidTerraformStateError(
        `lock must have an ID of 1 to ${MAX_LOCK_ID_LENGTH} characters`,
      );
    }

    return id;
  }

  heldAs(id: string | null): boolean {
    return id === this.id;
  }
}
