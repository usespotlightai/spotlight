import { SkillKey } from '@work/domain/value-objects/skill-key.vo';

export const HANDING_OVER = SkillKey.of('spotlight-handover');

export const OPENING_PULL_REQUESTS = SkillKey.of('spotlight-pull-request');

export const REVIEWING_PULL_REQUESTS = SkillKey.of('spotlight-review');

export const BUILT_IN_SKILL_KEYS: readonly SkillKey[] = [
  HANDING_OVER,
  OPENING_PULL_REQUESTS,
  REVIEWING_PULL_REQUESTS,
];
