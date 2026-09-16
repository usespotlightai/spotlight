import type { Line } from '@domain/aggregates/line.aggregate';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { LinePlan } from '@domain/value-objects/line-plan.vo';

export const LINE_CONFIG_READER = Symbol('LINE_CONFIG_READER');

export interface ReadLines {
  readonly plans: readonly LinePlan[];
  readonly problems: readonly ConfigurationProblem[];
}

export interface WrittenLine {
  readonly files: readonly ConfigurationFile[];
  readonly removes: readonly string[];
}

export interface LineConfigReaderPort {
  read(files: readonly ConfigurationFile[]): ReadLines;

  write(line: Line, over?: readonly ConfigurationFile[]): WrittenLine;
}
