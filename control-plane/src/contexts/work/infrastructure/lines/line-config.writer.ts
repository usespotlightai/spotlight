import { Injectable } from '@nestjs/common';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { stationsFolder } from '@work/application/contracts/line-layout.contract';
import type {
  LineConfigWriterPort,
  WrittenLine,
} from '@work/application/ports/line-config-writer.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { renderLine } from '@work/infrastructure/lines/line.render';

@Injectable()
export class LineConfigWriter implements LineConfigWriterPort {
  write(line: Line, over: readonly ConfigurationFile[] = []): WrittenLine {
    const files = renderLine(line);
    const writing = new Set(files.map((each) => each.path));
    const stations = stationsFolder(line.key.value);

    return {
      files,
      removes: over
        .filter(
          (each) =>
            each.isUnder(stations) &&
            each.path.endsWith('.md') &&
            !writing.has(each.path),
        )
        .map((each) => each.path),
    };
  }
}
