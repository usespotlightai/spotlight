import type { UnfinishedRun } from '@insights/domain/services/unfinished-runs';
import type { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';

export const WORK = Symbol('INSIGHTS_WORK');

export interface EndedRun {
  readonly runId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly taskId: string;
  readonly fingerprint: string | null;
  readonly visit: number;
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
  readonly skills: readonly { readonly key: string; readonly hash: string }[];
  readonly tools: readonly string[];
  readonly decisions: boolean;
  readonly memories: boolean;
  readonly judge?: {
    readonly rubricHash: string;
    readonly sample: number;
    readonly minAgreement: number;
  };
}

export interface ConfigInOrder {
  readonly fingerprint: string;
  readonly config: StationConfigView;
  readonly changes: readonly ConfigPart[];
}

export interface TracedStation {
  readonly stationId: string;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly count: number;
}

interface TracedTask {
  readonly taskId: string;
  readonly title: string;
  readonly input: string | null;
  readonly stationId: string;
}

export interface TracedWork {
  readonly tasks: readonly TracedTask[];
  readonly stations: readonly TracedStation[];
  readonly outputs: ReadonlyMap<string, string>;
}

export interface TracedWanted {
  readonly taskIds: readonly string[];
  readonly runIds: readonly string[];
  readonly stationIds: readonly string[];
}

export interface WorkPort {
  endedRun(runId: string): Promise<EndedRun | null>;

  unfinishedRuns(teamId: string): Promise<readonly UnfinishedRun[]>;

  traced(wanted: TracedWanted): Promise<TracedWork>;

  configsInOrder(
    fingerprints: readonly string[],
  ): Promise<readonly ConfigInOrder[]>;

  teamRepositories(teamId: string): Promise<readonly string[]>;

  teamSkillKeys(teamId: string): Promise<readonly string[]>;

  alertsAt(stationId: string): Promise<readonly AlertRule[] | null>;
}
