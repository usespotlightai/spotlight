export type AppGrant = 'workflows' | 'variables';

export class AppGrants {
  static readonly SETUP_NEEDS: readonly AppGrant[] = ['workflows', 'variables'];

  private constructor(private readonly lacking: ReadonlySet<AppGrant>) {}

  static of(granted: { workflows: boolean; variables: boolean }): AppGrants {
    return new AppGrants(
      new Set<AppGrant>([
        ...(granted.workflows ? [] : ['workflows' as const]),
        ...(granted.variables ? [] : ['variables' as const]),
      ]),
    );
  }

  static unread(): AppGrants {
    return new AppGrants(new Set());
  }

  lacks(grant: AppGrant): boolean {
    return this.lacking.has(grant);
  }

  missingForSetup(): readonly AppGrant[] {
    return AppGrants.SETUP_NEEDS.filter((each) => this.lacks(each));
  }

  equals(other: AppGrants): boolean {
    return (
      other instanceof AppGrants &&
      other.lacking.size === this.lacking.size &&
      [...this.lacking].every((each) => other.lacking.has(each))
    );
  }
}
