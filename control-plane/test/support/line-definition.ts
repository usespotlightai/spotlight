import type { LineOpening } from '@work/domain/services/built-in-lines';

export const definitionOf = (line: LineOpening) => ({
  key: line.key.value,
  name: line.name.value,
  ...(line.role ? { role: line.role.value } : {}),
  repositories: line.repositories.map((each) => each.value),
  stations: line.stations.map((station) => ({
    key: station.key.value,
    name: station.name.value,
    kind: station.kind,
    color: station.color.value,
    ...(station.agentPrompt ? { prompt: station.agentPrompt.value } : {}),
    tools: station.tools.map((each) => each.value),
    skills: (station.skills ?? []).map((each) => each.value),
    diffs: station.diffs ?? false,
    decisions: station.decisions ?? false,
    passesTo: station.passesTo.map((each) => each.value),
    ends: station.ends,
  })),
  reactions: line.reactions.map((each) => ({
    happening: each.happening.value,
    to: each.to.value,
  })),
});

export type LineDefinition = ReturnType<typeof definitionOf>;
