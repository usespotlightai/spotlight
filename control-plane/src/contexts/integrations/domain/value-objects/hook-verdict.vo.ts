export class HookVerdict {
  private constructor(readonly denyReason: string | null) {}

  static allowed(): HookVerdict {
    return new HookVerdict(null);
  }

  static denied(reason: string): HookVerdict {
    return new HookVerdict(reason.trim());
  }

  static onBrokenHook(
    hook: string,
    broken: string,
    blocks: boolean,
  ): HookVerdict {
    return blocks
      ? HookVerdict.denied(
          `Hook ${hook} is broken and blocks on failure. Reason: ${broken}`,
        )
      : HookVerdict.allowed();
  }

  get denies(): boolean {
    return this.denyReason !== null;
  }

  equals(other: HookVerdict): boolean {
    return this.denyReason === other.denyReason;
  }
}
