import type { ReadIntegrations } from '@configuration/application/ports/integration-reader.port';
import { ToolDeclarationMapper } from '@integrations/application/mappers/tool-declaration.mapper';
import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import { generatedTools } from '@integrations/domain/services/generated-tools';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import type { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import {
  type Compiled,
  compileIntegration,
  type ReadableIntegration,
} from '@integrations/infrastructure/integrations/integration.compile';
import type { OperationCache } from '@integrations/infrastructure/integrations/operation-cache';
import type { ExpressionEnginePort } from '@platform/expressions/expression-engine.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';

type ReadIntegration = Omit<
  ReadIntegrations['integrations'][number],
  'linked' | 'handle'
>;

export interface ReadDefinitions {
  readonly integrations: readonly ReadIntegration[];
  readonly problems: readonly ConfigurationProblem[];
}

export interface Offering {
  readonly readable: ReadableIntegration;
  readonly offered: OfferedTool;
  readonly operation: DescribedOperation | null;
}

const MAX_COMPILED = 500;

export class IntegrationReader {
  readonly #compiled = new Map<string, Compiled>();

  constructor(
    private readonly expressions: ExpressionEnginePort,
    private readonly operations: OperationCache,
  ) {}

  read(definitions: readonly DefinedIntegration[]): ReadDefinitions {
    const readable = this.readable(definitions);

    return {
      integrations: readable.integrations.map(
        ({ path, integration, described }) => {
          const defined = definitions.find(
            (each) => each.source === integration.source.value,
          );
          const handWritten = integration.offers.map((each) => each.tool);

          return {
            source: integration.source.value,
            path,
            name: integration.name,
            connects: integration.connects,
            holder: integration.holder.kind,
            credentials: integration.credentials,
            described:
              described && defined?.reading
                ? {
                    kind: described.source.kind,
                    tools: defined.offers.filter(
                      (each) => !handWritten.includes(each),
                    ).length,
                    readAt: defined.reading.readAt,
                    problem: defined.reading.problem,
                  }
                : null,
          };
        },
      ),
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
      const read = this.compiledOf(each);

      if (read.ok) {
        integrations.push(read.readable);
        problems.push(...read.warnings);
      } else {
        problems.push(...read.problems);
      }
    }

    return { integrations, problems };
  }

  async offering(
    definitions: readonly DefinedIntegration[],
    tool: string,
  ): Promise<Offering | null> {
    const source = tool.slice(0, tool.indexOf('.'));
    const name = tool.slice(tool.indexOf('.') + 1);
    const defined = definitions.find((each) => each.source === source);
    const compiled = defined?.offers.includes(tool)
      ? this.compiledOf(defined)
      : null;

    if (!defined || !compiled?.ok) {
      return null;
    }

    const readable = compiled.readable;
    const written = readable.integration.offered(tool);

    if (written) {
      return { readable, offered: written, operation: null };
    }

    if (!defined.generatedFrom || !readable.described) {
      return null;
    }

    const hash = ContentHash.of(defined.generatedFrom);
    const operation = await this.operations.of(hash, name);
    const [offered] = operation
      ? generatedTools({
          source: readable.integration.source,
          integration: readable.integration.name,
          described: readable.described.source,
          hash,
          operations: [operation],
          filter: readable.described.filter,
          approvals: readable.described.approvals,
          handWritten: [...readable.tools.keys()],
        }).tools
      : [];

    return operation && offered ? { readable, offered, operation } : null;
  }

  private compiledOf(defined: DefinedIntegration): Compiled {
    const key = `${defined.id}:${defined.version}`;
    const cached = this.#compiled.get(key);

    if (cached) {
      return cached;
    }

    const compiled = compileIntegration(defined.definition, this.expressions);

    this.#compiled.set(key, compiled);

    for (const oldest of this.#compiled.keys()) {
      if (this.#compiled.size <= MAX_COMPILED) {
        break;
      }
      this.#compiled.delete(oldest);
    }

    return compiled;
  }

  async declared(
    definitions: readonly DefinedIntegration[],
    tools: readonly string[],
  ): Promise<readonly ToolDeclaration[]> {
    const offerings = [];

    for (const tool of tools) {
      offerings.push(await this.offering(definitions, tool));
    }

    return offerings.flatMap((each) =>
      each
        ? [
            ToolDeclarationMapper.toDeclaration(
              each.offered,
              each.readable.integration.name,
            ),
          ]
        : [],
    );
  }
}
