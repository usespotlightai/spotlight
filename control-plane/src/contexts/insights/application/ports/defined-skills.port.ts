export const DEFINED_SKILLS = Symbol('DEFINED_SKILLS');

export interface DefinedSkillsPort {
  keysOf(teamId: string): Promise<readonly string[]>;
}
