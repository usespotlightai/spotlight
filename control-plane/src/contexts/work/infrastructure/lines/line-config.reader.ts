import { Injectable } from '@nestjs/common';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { LINES_UNDER } from '@work/application/contracts/line-layout.contract';
import type {
  LineConfigReaderPort,
  ReadLines,
} from '@work/application/ports/line-config-reader.port';
import type { LinePlan } from '@work/domain/value-objects/line-plan.vo';
import { compileLine } from '@work/infrastructure/lines/line.compile';

const loose = (file: ConfigurationFile): ConfigurationProblem =>
  ConfigurationProblem.of({
    path: file.path,
    at: 'the file',
    reason: `sits in ${LINES_UNDER} itself, where no line reads it: put it in the folder of the line it belongs to`,
    severity: 'warning',
  });

@Injectable()
export class LineConfigReader implements LineConfigReaderPort {
  read(files: readonly ConfigurationFile[]): ReadLines {
    const folders = new Map<string, ConfigurationFile[]>();
    const problems: ConfigurationProblem[] = [];

    for (const file of files.filter((each) => each.isUnder(LINES_UNDER))) {
      const within = file.path.slice(LINES_UNDER.length + 1);
      const cut = within.indexOf('/');

      if (cut < 0) {
        problems.push(loose(file));
        continue;
      }

      const folder = within.slice(0, cut);
      folders.set(folder, [...(folders.get(folder) ?? []), file]);
    }

    const plans: LinePlan[] = [];

    for (const folder of [...folders.keys()].sort()) {
      const read = compileLine(folder, folders.get(folder) ?? []);

      if (read.ok) {
        plans.push(read.line);
      }
      problems.push(...read.problems);
    }

    return { plans, problems };
  }
}
