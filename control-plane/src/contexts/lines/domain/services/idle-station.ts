import type { StationKind } from '@lines/domain/entities/station.entity';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

export type IdleStationSetting =
  | 'judge'
  | 'alerts'
  | 'search'
  | 'harness'
  | 'model'
  | 'effort'
  | 'profile'
  | 'prompt'
  | 'check'
  | 'runners'
  | 'diffs'
  | 'decisions'
  | 'memories';

export interface StationSettings {
  readonly kind?: StationKind;
  readonly judge?: unknown;
  readonly alerts?: readonly unknown[];
  readonly search?: unknown;
  readonly harness?: unknown;
  readonly model?: unknown;
  readonly effort?: unknown;
  readonly profile?: unknown;
  readonly agentPrompt?: unknown;
  readonly check?: unknown;
  readonly placement?: RunnerPlacement;
  readonly diffs?: boolean;
  readonly decisions?: boolean;
  readonly memories?: boolean;
}

export interface IdleStationProblem {
  readonly setting: IdleStationSetting;
  readonly reason: string;
}

const IDLE: Readonly<Record<Exclude<StationKind, 'work'>, string>> = {
  backlog: 'is a backlog',
  completed: 'is the completed station',
};

const BECAUSE: Readonly<Record<IdleStationSetting, string>> = {
  judge: 'has no runs to judge',
  alerts: 'has no runs to alert on',
  search: 'has no runs to improve',
  harness: 'runs no agent, so it takes no harness',
  model: 'runs no agent, so it takes no model',
  effort: 'runs no agent, so it takes no effort',
  profile: 'runs no agent, so it takes no profile',
  prompt: 'runs no agent, so it takes no prompt',
  check: 'runs no agent, so it takes no check',
  runners: 'runs no agent, so it takes no runners',
  diffs: 'runs no agent, so it shows no diffs',
  decisions: 'runs no agent, so it records no decisions',
  memories: 'runs no agent, so it uses no memories',
};

const given = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== false;

const settingsOf = (
  station: StationSettings,
): Readonly<Record<IdleStationSetting, boolean>> => ({
  judge: given(station.judge),
  alerts: (station.alerts ?? []).length > 0,
  search: given(station.search),
  harness: given(station.harness),
  model: given(station.model),
  effort: given(station.effort),
  profile: given(station.profile),
  prompt: given(station.agentPrompt),
  check: given(station.check),
  runners: station.placement !== undefined && !station.placement.isAnywhere,
  diffs: station.diffs === true,
  decisions: station.decisions === true,
  memories: station.memories === true,
});

export const idleStationProblem = (
  station: StationSettings,
): IdleStationProblem | null => {
  if (station.kind === undefined || station.kind === 'work') {
    return null;
  }

  const settings = settingsOf(station);
  const setting = (Object.keys(BECAUSE) as IdleStationSetting[]).find(
    (each) => settings[each],
  );

  return setting
    ? {
        setting,
        reason: `${IDLE[station.kind]} and ${BECAUSE[setting]}`,
      }
    : null;
};
