export const WORK = Symbol('OUTCOMES_WORK');

export interface EndedRun {
  readonly runId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly taskId: string;
  readonly fingerprint: string | null;
  readonly round: number;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profileKey: string | null;
  readonly repositories: readonly string[];
  readonly skills: readonly string[];
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date;
}

export interface ConfigPart {
  readonly part: string;
  readonly name: string | null;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly was: string | null;
  readonly now: string | null;
}

export interface StationConfigView {
  readonly prompt: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profile: { readonly key: string; readonly settings: unknown } | null;
  readonly image: string | null;
  readonly repositories: readonly {
    readonly name: string;
    readonly setup: string | null;
  }[];
  readonly skills: readonly { readonly key: string; readonly digest: string }[];
  readonly tools: readonly string[];
  readonly decisions: boolean;
  readonly memories: boolean;
  readonly judge?: {
    readonly rubricDigest: string;
    readonly sample: number;
    readonly trust: number;
  };
}

export interface ConfigInOrder {
  readonly fingerprint: string;
  readonly config: StationConfigView;
  readonly changes: readonly ConfigPart[];
}

export interface WorkPort {
  endedRun(runId: string): Promise<EndedRun | null>;

  configsInOrder(
    fingerprints: readonly string[],
  ): Promise<readonly ConfigInOrder[]>;

  teamRepositories(teamId: string): Promise<readonly string[]>;

  teamSkillKeys(teamId: string): Promise<readonly string[]>;
}
