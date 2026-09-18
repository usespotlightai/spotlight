import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';

export const LINE_CONFIG_WRITER = Symbol('LINE_CONFIG_WRITER');

export interface WrittenLine {
  readonly files: readonly ConfigurationFile[];
  readonly removes: readonly string[];
}

export interface LineConfigWriterPort {
  write(line: Line, over?: readonly ConfigurationFile[]): WrittenLine;
}
