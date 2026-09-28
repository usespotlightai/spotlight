import type { ReadIntegrations } from '@configuration/application/ports/integration-reader.port';
import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { ReadableIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import { compileIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import type { ExpressionEnginePort } from '@platform/expressions/expression-engine.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

type ReadIntegration = Omit<
  ReadIntegrations['integrations'][number],
  'linked' | 'handle'
>;

export interface ReadDefinitions {
  readonly integrations: readonly ReadIntegration[];
  readonly problems: readonly ConfigurationProblem[];
}

export class IntegrationReader {
  constructor(private readonly expressions: ExpressionEnginePort) {}

  read(definitions: readonly DefinedIntegration[]): ReadDefinitions {
    const readable = this.readable(definitions);

    return {
      integrations: readable.integrations.map(({ path, integration }) => ({
        source: integration.source.value,
        path,
        name: integration.name,
        connects: integration.connects,
        credentials: integration.credentials,
        offers: integration.offers.map((each) => ({
          tool: each.tool,
          description: each.description,
          inputs: each.inputs,
          approval: each.approval ? { because: each.approval.because } : null,
        })),
      })),
      problems: readable.problems,
    };
  }

  readable(definitions: readonly DefinedIntegration[]): {
    integrations: readonly ReadableIntegration[];
    problems: readonly ConfigurationProblem[];
  } {
    const integrations: ReadableIntegration[] = [];
    const problems: ConfigurationProblem[] = [];

    for (const each of definitions) {
      const read = compileIntegration(each.definition, this.expressions);

      if (read.ok) {
        integrations.push(read.readable);
        problems.push(...read.warnings);
      } else {
        problems.push(...read.problems);
      }
    }

    return { integrations, problems };
  }
}
