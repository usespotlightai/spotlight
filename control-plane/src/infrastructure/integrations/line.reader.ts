import type {
  LineReaderPort,
  ReadLines,
} from '@application/ports/line-reader.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { linePath } from '@domain/aggregates/team-configuration.aggregate';
import type { LinePlan } from '@domain/model/line-plan';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { compileLine } from '@infrastructure/integrations/line.compile';
import { renderLine } from '@infrastructure/integrations/line.render';
import { Injectable } from '@nestjs/common';

@Injectable()
export class LineReader implements LineReaderPort {
  read(files: readonly ConfigurationFile[]): ReadLines {
    const plans: LinePlan[] = [];
    const problems: ConfigurationProblem[] = [];
    const claimed = new Map<string, string>();

    for (const file of files) {
      const read = compileLine(file.path, file.text);

      if (!read.ok) {
        problems.push(...read.problems);
        continue;
      }

      const already = claimed.get(read.line.key.value);

      // Two files describing one line is a workspace that has to choose.
      if (already) {
        problems.push(
          ConfigurationProblem.of({
            path: file.path,
            at: 'key',
            reason: `is already described by ${already}, so this file is not read`,
          }),
        );
        continue;
      }

      claimed.set(read.line.key.value, file.path);
      plans.push(read.line);
    }

    return { plans, problems };
  }

  write(line: AssemblyLine): ConfigurationFile {
    return ConfigurationFile.of(linePath(line.key.value), renderLine(line));
  }
}
