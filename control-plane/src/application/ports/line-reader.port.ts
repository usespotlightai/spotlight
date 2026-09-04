import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { LinePlan } from '@domain/model/line-plan';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';

export const LINE_READER = Symbol('LINE_READER');

export interface ReadLines {
  readonly plans: readonly LinePlan[];
  readonly problems: readonly ConfigurationProblem[];
}

/**
 * Turns the files a workspace keeps into the lines they describe. What the
 * files are written in is this port's business; the application asks what a
 * workspace's lines should be, and gets the domain's own words back.
 */
export interface LineReaderPort {
  read(files: readonly ConfigurationFile[]): ReadLines;

  write(line: AssemblyLine): ConfigurationFile;
}
