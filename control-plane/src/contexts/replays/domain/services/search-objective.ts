import type { SetHealth } from '@replays/domain/services/set-health';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';

export const objectiveFor = (
  asked: SearchObjective | null,
  health: SetHealth,
): SearchObjective =>
  asked ?? (health.saturation?.saturated ? 'cost' : 'success');
