export interface TeamSkillDto {
  readonly key: string;
  readonly description: string;
  readonly path: string;
}

export interface TeamSkillsDto {
  readonly repository: string | null;
  readonly skills: readonly TeamSkillDto[];
}
