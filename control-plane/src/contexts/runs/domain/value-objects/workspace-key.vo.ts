import { RequesterOwner } from '@runs/domain/value-objects/run-requester.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export const WORKSPACE_RESTORES = ['always', 'when-continuing'] as const;

export type WorkspaceRestores = (typeof WORKSPACE_RESTORES)[number];

export class WorkspaceKey {
  private constructor(
    readonly owner: RequesterOwner,
    readonly name: string,
  ) {}

  static of(owner: string, name: string): WorkspaceKey {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      throw new InvalidIdentifierError('workspace key');
    }

    return new WorkspaceKey(RequesterOwner.of(owner), trimmed);
  }

  static parse(raw: string): WorkspaceKey {
    const at = raw.indexOf('/');

    if (at <= 0) {
      throw new InvalidIdentifierError(
        'workspace key',
        'must name its owner and a name, as <owner>/<name>',
      );
    }

    return WorkspaceKey.of(raw.slice(0, at), raw.slice(at + 1));
  }

  get value(): string {
    return `${this.owner.value}/${this.name}`;
  }

  equals(other: WorkspaceKey): boolean {
    return this.value === other.value;
  }
}

export class RunWorkspace {
  private constructor(
    readonly key: WorkspaceKey,
    readonly rejoinable: boolean,
    readonly restores: WorkspaceRestores,
  ) {}

  static of(input: {
    key: WorkspaceKey;
    rejoinable: boolean;
    restores: WorkspaceRestores;
  }): RunWorkspace {
    return new RunWorkspace(input.key, input.rejoinable, input.restores);
  }

  restoresWhen(continuesASession: boolean): boolean {
    return this.restores === 'always' || continuesASession;
  }

  equals(other: RunWorkspace): boolean {
    return (
      this.key.equals(other.key) &&
      this.rejoinable === other.rejoinable &&
      this.restores === other.restores
    );
  }
}
