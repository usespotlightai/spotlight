import {
  type CandidateKind,
  isLiveKind,
} from '@replays/domain/value-objects/candidate-kind';

export interface ReplayedConfig {
  readonly name: string;
  readonly kind: CandidateKind;
}

const replayedOf = (config: ReplayedConfig): string => {
  if (isLiveKind(config.kind)) {
    return 'the live config';
  }

  return config.kind === 'searched' ? `candidate ${config.name}` : config.name;
};

export const replayRunTitle = (
  config: ReplayedConfig,
  stationName: string | null,
): string =>
  stationName === null
    ? `Replay of ${replayedOf(config)}`
    : `Replay of ${replayedOf(config)} at ${stationName}`;
