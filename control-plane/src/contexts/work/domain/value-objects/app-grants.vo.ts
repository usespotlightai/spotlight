export type AppGrant = 'workflows' | 'variables';

export type CiWorkflows = 'permitted' | 'not-permitted';

// What the workspace's GitHub App may do beyond cloning and pushing code.
export class AppGrants {
  // The setup adds a GitHub Actions workflow and sets repository variables.
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

  // Spotlight could not read the grants, so it claims none is missing.
  static unread(): AppGrants {
    return new AppGrants(new Set());
  }

  lacks(grant: AppGrant): boolean {
    return this.lacking.has(grant);
  }

  missingForSetup(): readonly AppGrant[] {
    return AppGrants.SETUP_NEEDS.filter((each) => this.lacks(each));
  }

  get workflows(): CiWorkflows {
    return this.lacks('workflows') ? 'not-permitted' : 'permitted';
  }

  equals(other: AppGrants): boolean {
    return (
      other instanceof AppGrants &&
      other.lacking.size === this.lacking.size &&
      [...this.lacking].every((each) => other.lacking.has(each))
    );
  }
}
