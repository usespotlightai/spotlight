import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { LineKey } from '@work/domain/value-objects/line-key.vo';
import type { LinePlan } from '@work/domain/value-objects/line-plan.vo';

export const LINE_CONFIG_READER = Symbol('LINE_CONFIG_READER');

export interface ReadLines {
  readonly plans: readonly LinePlan[];
  readonly problems: readonly ConfigurationProblem[];
}

export interface LineConfigReaderPort {
  read(files: readonly ConfigurationFile[]): ReadLines;

  definedAt(line: LineKey): string;
}
