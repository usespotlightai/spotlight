export const SKILL_REDEFINED = 'configuration.skill-redefined.v1';

export type SkillRedefinedIntegrationEvent = {
  readonly kind: typeof SKILL_REDEFINED;
  readonly skillId: string;
  readonly teamId: string;
  readonly key: string;
};
