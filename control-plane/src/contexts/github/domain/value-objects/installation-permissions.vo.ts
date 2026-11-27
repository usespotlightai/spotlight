const WRITE = 'write';

export class InstallationPermissions {
  private readonly kind = 'installation-permissions';

  private constructor(private readonly granted: ReadonlyMap<string, string>) {}

  static of(
    granted: Readonly<Record<string, unknown>>,
  ): InstallationPermissions {
    return new InstallationPermissions(
      new Map(
        Object.entries(granted).flatMap(([name, level]) =>
          typeof level === 'string' ? [[name, level] as const] : [],
        ),
      ),
    );
  }

  changesWorkflows(): boolean {
    return this.granted.get('workflows') === WRITE;
  }

  setsVariables(): boolean {
    return this.granted.get('actions_variables') === WRITE;
  }

  grantsBeyond(other: InstallationPermissions): boolean {
    return (
      (this.changesWorkflows() && !other.changesWorkflows()) ||
      (this.setsVariables() && !other.setsVariables())
    );
  }

  equals(other: InstallationPermissions): boolean {
    return (
      other instanceof InstallationPermissions &&
      other.granted.size === this.granted.size &&
      [...this.granted].every(
        ([name, level]) => other.granted.get(name) === level,
      )
    );
  }
}
