export const WARM_SANDBOXES = Symbol('WARM_SANDBOXES');

export interface WarmSandboxOrder {
  readonly workspaceId: string;
  readonly lineId: string;
  readonly placement: {
    readonly labelGroups: readonly (readonly string[])[];
    readonly image: string | null;
  };
  readonly checkouts: readonly {
    readonly path: string;
    readonly setup: string | null;
  }[];
  readonly shape: string;
}

export interface KeptWarmSandbox {
  readonly id: string;
  readonly workspaceId: string;
  readonly lineId: string;
  readonly shape: string;
}

export interface WarmSandboxesPort {
  kept(): Promise<readonly KeptWarmSandbox[]>;

  linesLostSince(cutoff: Date): Promise<readonly string[]>;

  request(order: WarmSandboxOrder, at: Date): Promise<void>;

  retire(sandboxId: string): Promise<void>;
}
