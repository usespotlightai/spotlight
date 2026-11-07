const BEFORE_BUDGET_MS = 60_000;

export class HookDecision {
  private constructor(readonly denyReason: string | null) {}

  static budgetFrom(at: Date, until: Date | null): Date {
    return new Date(
      Math.min(
        until?.getTime() ?? Number.POSITIVE_INFINITY,
        at.getTime() + BEFORE_BUDGET_MS,
      ),
    );
  }

  static allowed(): HookDecision {
    return new HookDecision(null);
  }

  static denied(reason: string): HookDecision {
    return new HookDecision(reason.trim());
  }

  static onBrokenHook(
    hook: string,
    broken: string,
    blocks: boolean,
  ): HookDecision {
    return blocks
      ? HookDecision.denied(
          `Hook ${hook} is broken and blocks on failure. Reason: ${broken}`,
        )
      : HookDecision.allowed();
  }

  get denies(): boolean {
    return this.denyReason !== null;
  }

  equals(other: HookDecision): boolean {
    return this.denyReason === other.denyReason;
  }
}
