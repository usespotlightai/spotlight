export interface SkillFile {
  readonly path: string;
  readonly text: string;
}

export interface SkillBrief {
  readonly key: string;
  readonly description: string;
  readonly tools: readonly string[];
}

export interface ReadySkillFolder {
  readonly skill: SkillBrief;
  readonly files: readonly SkillFile[];
}
