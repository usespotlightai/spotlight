export interface TeamSkillDto {
  readonly key: string;
  readonly description: string;
  readonly path: string;
}

export interface TeamSkillsDto {
  readonly skills: readonly TeamSkillDto[];
}
