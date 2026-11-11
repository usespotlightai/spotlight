import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';

export class SkillMainFileMissingError extends InvalidSkillError {
  constructor(skill: string, file: string) {
    super(skill, `has no ${file}. Spotlight reads each skill from its ${file}`);
    this.name = 'SkillMainFileMissingError';
  }
}
