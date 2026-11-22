import type { StationKind } from '@lines/domain/entities/station.entity';

/** A station's agent features: change stacks, decisions and memories. */
export interface AgentFeatures {
  readonly diffs: boolean;
  readonly decisions: boolean;
  readonly memories: boolean;
}

/**
 * The agent features a station has, from those its line writes. A station that runs an agent has every one it does
 * not turn off; a backlog or the completed station runs no agent and has none it does not turn on. This is the one
 * place the default is decided: whatever fills in a station asks it.
 */
export const agentFeaturesOf = (
  kind: StationKind,
  written: Partial<AgentFeatures> = {},
): AgentFeatures => {
  const on = kind === 'work';

  return {
    diffs: written.diffs ?? on,
    decisions: written.decisions ?? on,
    memories: written.memories ?? on,
  };
};
