export interface TeamSkillDto {
  readonly key: string;
  readonly description: string;
}

export interface TeamSkillsDto {
  readonly skills: readonly TeamSkillDto[];
}
