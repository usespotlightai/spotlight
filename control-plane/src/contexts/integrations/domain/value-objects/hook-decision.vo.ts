export class HookDecision {
  private constructor(readonly denyReason: string | null) {}

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
