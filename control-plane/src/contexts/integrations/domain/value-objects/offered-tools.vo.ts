import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { Integration } from '@integrations/domain/value-objects/integration.vo';
import type { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';

export type ToolSource =
  | { readonly kind: 'none' }
  | { readonly kind: 'written'; readonly tool: ProvidedTool }
  | { readonly kind: 'generated'; readonly from: ContentHash };

const named = (tools: readonly ToolName[], tool: ToolName): boolean =>
  tools.some((each) => each.equals(tool));

export class OfferedTools {
  private constructor(
    readonly integration: Integration,
    readonly written: readonly ProvidedTool[],
    readonly generated: readonly ToolName[],
    readonly generatedFrom: ContentHash | null,
  ) {}

  static generatedFor(
    integration: Integration,
    generated: readonly ProvidedTool[],
  ): OfferedTools {
    const key = integration.key;
    const hashes = new Set<string>();
    let generatedFrom: ContentHash | null = null;

    for (const provided of generated) {
      const spec = provided.backing.spec;

      if (!provided.integration.equals(key)) {
        throw new InvalidIntegrationError(
          key.value,
          `offers tool ${provided.tool.value}, which is named for another integration`,
        );
      }

      if (!spec || !integration.apiSpec) {
        throw new InvalidIntegrationError(
          key.value,
          `generates tool ${provided.tool.value} without an API spec`,
        );
      }

      hashes.add(spec.hash.value);
      generatedFrom = spec.hash;
    }

    if (hashes.size > 1) {
      throw new InvalidIntegrationError(
        key.value,
        'provides tools from two fetches of its spec',
      );
    }

    const names = [
      ...integration.writtenTools.map((each) => each.tool.value),
      ...generated.map((each) => each.tool.value),
    ];

    if (new Set(names).size !== names.length) {
      throw new InvalidIntegrationError(
        key.value,
        'offers a tool more than once',
      );
    }

    return new OfferedTools(
      integration,
      integration.writtenTools,
      generated.map((each) => each.tool),
      generatedFrom,
    );
  }

  static listed(
    integration: Integration,
    listed: readonly ToolName[],
    generatedFrom: ContentHash | null,
  ): OfferedTools {
    const written = integration.writtenTools.filter((each) =>
      named(listed, each.tool),
    );
    const generated =
      generatedFrom && integration.apiSpec
        ? listed.filter((each) => !integration.writtenTool(each))
        : [];

    return new OfferedTools(integration, written, generated, generatedFrom);
  }

  enabledOnMarks(kinds: readonly MarkKind[]): readonly ToolName[] {
    return this.written
      .filter((each) =>
        kinds.some((kind) => each.enabledOnMark?.equals(kind) ?? false),
      )
      .map((each) => each.tool);
  }

  get all(): readonly ToolName[] {
    return [...this.written.map((each) => each.tool), ...this.generated];
  }

  get generatedCount(): number {
    return this.generated.length;
  }

  offers(tool: ToolName): boolean {
    return named(this.all, tool);
  }

  sourceOf(tool: ToolName): ToolSource {
    const written = this.written.find((each) => each.tool.equals(tool));

    if (written) {
      return { kind: 'written', tool: written };
    }

    return this.generatedFrom && named(this.generated, tool)
      ? { kind: 'generated', from: this.generatedFrom }
      : { kind: 'none' };
  }

  takesPersonRuleFor(tool: ToolName): boolean {
    return this.integration.actsAs.byRequester && this.offers(tool);
  }
}
