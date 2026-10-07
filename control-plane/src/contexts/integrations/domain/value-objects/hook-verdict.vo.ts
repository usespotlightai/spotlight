export class HookVerdict {
  private constructor(readonly refusal: string | null) {}

  static allowed(): HookVerdict {
    return new HookVerdict(null);
  }

  static refused(reason: string): HookVerdict {
    return new HookVerdict(reason.trim());
  }

  static onBrokenHook(
    hook: string,
    broken: string,
    blocks: boolean,
  ): HookVerdict {
    return blocks
      ? HookVerdict.refused(
          `Hook ${hook} is broken and blocks on failure. Reason: ${broken}`,
        )
      : HookVerdict.allowed();
  }

  get refuses(): boolean {
    return this.refusal !== null;
  }

  equals(other: HookVerdict): boolean {
    return this.refusal === other.refusal;
  }
}
