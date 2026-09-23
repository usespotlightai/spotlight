export const SKILL_RETIRED = 'configuration.skill-retired.v1';

export type SkillRetiredIntegrationEvent = {
  readonly kind: typeof SKILL_RETIRED;
  readonly skillId: string;
  readonly teamId: string;
  readonly key: string;
};
