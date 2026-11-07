import { RunWorkingCopyKeyConflictError } from '@runs/domain/exceptions/run-working-copy-key-conflict.error';
import { RequesterOwner } from '@runs/domain/value-objects/run-requester.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export const WORKING_COPY_RESTORES = ['always', 'when-continuing'] as const;

export type WorkingCopyRestores = (typeof WORKING_COPY_RESTORES)[number];

export class WorkingCopyKey {
  private constructor(
    readonly owner: RequesterOwner,
    readonly name: string,
  ) {}

  static of(owner: string, name: string): WorkingCopyKey {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      throw new InvalidIdentifierError('working copy key');
    }

    return new WorkingCopyKey(RequesterOwner.of(owner), trimmed);
  }

  static parse(raw: string): WorkingCopyKey {
    const at = raw.indexOf('/');

    if (at <= 0) {
      throw new InvalidIdentifierError(
        'working copy key',
        'must name its owner and a name, as <owner>/<name>',
      );
    }

    return WorkingCopyKey.of(raw.slice(0, at), raw.slice(at + 1));
  }

  static requestedBy(owner: string, requested: string): WorkingCopyKey {
    const at = requested.indexOf('/');

    if (at < 0) {
      return WorkingCopyKey.of(owner, requested);
    }

    if (requested.slice(0, at) !== owner) {
      throw new RunWorkingCopyKeyConflictError(requested);
    }

    return WorkingCopyKey.of(owner, requested.slice(at + 1));
  }

  get value(): string {
    return `${this.owner.value}/${this.name}`;
  }

  equals(other: WorkingCopyKey): boolean {
    return this.value === other.value;
  }
}

export class RunWorkingCopy {
  private constructor(
    readonly key: WorkingCopyKey,
    readonly rejoinable: boolean,
    readonly restores: WorkingCopyRestores,
  ) {}

  static of(input: {
    key: WorkingCopyKey;
    rejoinable: boolean;
    restores: WorkingCopyRestores;
  }): RunWorkingCopy {
    return new RunWorkingCopy(input.key, input.rejoinable, input.restores);
  }

  restoresWhen(continuesASession: boolean): boolean {
    return this.restores === 'always' || continuesASession;
  }

  equals(other: RunWorkingCopy): boolean {
    return (
      this.key.equals(other.key) &&
      this.rejoinable === other.rejoinable &&
      this.restores === other.restores
    );
  }
}
