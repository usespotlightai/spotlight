export const SKILL_DEFINED = 'configuration.skill-defined.v1';

export type SkillDefinedIntegrationEvent = {
  readonly kind: typeof SKILL_DEFINED;
  readonly skillId: string;
  readonly teamId: string;
  readonly key: string;
};
