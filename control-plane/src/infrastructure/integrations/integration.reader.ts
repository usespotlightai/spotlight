import type {
  IntegrationReaderPort,
  ReadIntegrations,
} from '@application/ports/integration-reader.port';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { ReadableIntegration } from '@infrastructure/integrations/integration.compile';
import { compileIntegration } from '@infrastructure/integrations/integration.compile';
import { Injectable } from '@nestjs/common';

@Injectable()
export class IntegrationReader implements IntegrationReaderPort {
  read(files: readonly ConfigurationFile[]): ReadIntegrations {
    const readable = this.readable(files);

    return {
      integrations: readable.integrations.map((each) => each.integration),
      problems: readable.problems,
    };
  }

  readable(files: readonly ConfigurationFile[]): {
    integrations: readonly ReadableIntegration[];
    problems: readonly ConfigurationProblem[];
  } {
    const integrations: ReadableIntegration[] = [];
    const problems: ConfigurationProblem[] = [];
    const claimed = new Map<string, string>();

    for (const file of files) {
      const read = compileIntegration(file.path, file.text);

      if (!read.ok) {
        problems.push(...read.problems);
        continue;
      }

      problems.push(...read.warnings);

      const key = read.readable.integration.source.value;
      const already = claimed.get(key);

      if (already) {
        problems.push(
          ConfigurationProblem.of({
            path: file.path,
            at: 'source',
            reason: `is already declared by ${already}, so this file is not read`,
          }),
        );
        continue;
      }

      claimed.set(key, file.path);
      integrations.push(read.readable);
    }

    return { integrations, problems };
  }
}
