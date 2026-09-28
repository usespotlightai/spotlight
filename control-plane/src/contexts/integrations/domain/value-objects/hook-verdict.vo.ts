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
          `The hook ${hook} no longer reads as it was written (${broken}), and it blocks on failure`,
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
