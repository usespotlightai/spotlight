import { ToolDeclarationMapper } from '@integrations/application/mappers/tool-declaration.mapper';
import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { ToolDeclarationsPort } from '@integrations/application/ports/tool-declarations.port';
import { generatedTools } from '@integrations/domain/services/generated-tools';
import type { ActsAsKind } from '@integrations/domain/value-objects/acts-as.vo';
import type { ApiSpecKind } from '@integrations/domain/value-objects/api-spec.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import type { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import {
  type Compiled,
  compileIntegration,
  type ReadableIntegration,
} from '@integrations/infrastructure/integrations/integration.compile';
import type { OperationCache } from '@integrations/infrastructure/integrations/operation-cache';
import type { ExpressionEnginePort } from '@platform/expressions/expression-engine.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';

export interface ReadSpec {
  readonly kind: ApiSpecKind;
  readonly tools: number;
  readonly readAt: Date;
  readonly problem: string | null;
}

export interface ReadIntegration {
  readonly integration: string;
  readonly path: string;
  readonly name: string;
  readonly requiresConnection: boolean;
  readonly actsAs: ActsAsKind;
  readonly credentials: readonly SecretName[];
  readonly spec: ReadSpec | null;
}

export interface ReadDefinitions {
  readonly integrations: readonly ReadIntegration[];
  readonly problems: readonly ConfigurationProblem[];
}

export interface FoundTool {
  readonly readable: ReadableIntegration;
  readonly tool: ProvidedTool;
  readonly operation: SpecOperation | null;
}

const MAX_COMPILED = 500;

export class IntegrationReader implements ToolDeclarationsPort {
  readonly #compiled = new Map<string, Compiled>();

  constructor(
    private readonly expressions: ExpressionEnginePort,
    private readonly operations: OperationCache,
  ) {}

  read(definitions: readonly DefinedIntegration[]): ReadDefinitions {
    const readable = this.readable(definitions);

    return {
      integrations: readable.integrations.map(
        ({ path, integration, apiSpec }) => {
          const defined = definitions.find(
            (each) => each.integration === integration.key.value,
          );

          return {
            integration: integration.key.value,
            path,
            name: integration.name,
            requiresConnection: integration.requiresConnection,
            actsAs: integration.actsAs.kind,
            credentials: integration.credentials,
            spec:
              apiSpec && defined?.reading
                ? {
                    kind: apiSpec.spec.kind,
                    tools: integration.generatedToolCount(defined.tools),
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

  async providedTool(
    definitions: readonly DefinedIntegration[],
    tool: string,
  ): Promise<FoundTool | null> {
    const named = ToolName.parsed(tool);
    const name = named?.name ?? '';
    const defined = named
      ? definitions.find((each) => each.integration === named.integration.value)
      : undefined;
    const compiled = defined?.tools.includes(tool)
      ? this.compiledOf(defined)
      : null;

    if (!defined || !compiled?.ok) {
      return null;
    }

    const readable = compiled.readable;
    const written = readable.integration.providedTool(tool);

    if (written) {
      return { readable, tool: written, operation: null };
    }

    if (!defined.generatedFrom || !readable.apiSpec) {
      return null;
    }

    const hash = ContentHash.of(defined.generatedFrom);
    const operation = await this.operations.of(hash, name);
    const [provided] = operation
      ? generatedTools({
          integration: readable.integration.key,
          integrationName: readable.integration.name,
          spec: readable.apiSpec.spec,
          hash,
          operations: [operation],
          filter: readable.apiSpec.filter,
          approvals: readable.apiSpec.approvals,
          handWritten: [...readable.tools.keys()],
        }).tools
      : [];

    return operation && provided
      ? { readable, tool: provided, operation }
      : null;
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
    const providedTools = [];

    for (const tool of tools) {
      providedTools.push(await this.providedTool(definitions, tool));
    }

    return providedTools.flatMap((each) =>
      each
        ? [
            ToolDeclarationMapper.toDeclaration(
              each.tool,
              each.readable.integration.name,
            ),
          ]
        : [],
    );
  }
}
