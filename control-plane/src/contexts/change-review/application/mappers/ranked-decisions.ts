import type { DecisionDto } from '@change-review/application/dto/decision.dto';

const RANK: Record<DecisionDto['kind'], number> = {
  deviation: 0,
  limitation: 1,
  assumption: 2,
  'trade-off': 3,
  'rejected-approach': 4,
};

export const ranked = (decisions: readonly DecisionDto[]): DecisionDto[] =>
  [...decisions].sort((a, b) => RANK[a.kind] - RANK[b.kind]);
