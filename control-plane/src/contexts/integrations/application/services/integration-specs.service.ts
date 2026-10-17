import type {
  IntegrationCompilerPort,
  ParsedIntegration,
  SpecOperations,
} from '@integrations/application/ports/integration-compiler.port';
import type { SpecReaderPort } from '@integrations/application/ports/spec-reader.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import { SpecDocument } from '@integrations/domain/aggregates/spec-document.aggregate';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { SpecDocumentRepository } from '@integrations/domain/repositories/spec-document.repository';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { SpecFetchResult } from '@integrations/domain/value-objects/spec-fetch-result.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface SpecForDefinition {
  readonly reading: SpecFetchResult;
  readonly specOperations: SpecOperations | null;
}

export interface IntegrationWithSpec {
  readonly compiled: ParsedIntegration;
  readonly reading: SpecFetchResult | null;
}

export class IntegrationSpecs {
  constructor(
    private readonly compiler: IntegrationCompilerPort,
    private readonly documents: SpecDocumentRepository,
    private readonly reader: SpecReaderPort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly clock: ClockPort,
  ) {}

  async compiled(input: {
    definition: unknown;
    teamId: TeamId;
    current: SpecFetchResult | null;
    refreshingSpec?: boolean;
  }): Promise<IntegrationWithSpec> {
    const first = this.compiler.compile(input.definition);

    if (!first.ok || !first.spec) {
      return { compiled: first, reading: null };
    }

    const located = {
      teamId: input.teamId,
      integration: first.integration,
      spec: first.spec,
    };
    const fetched = input.refreshingSpec
      ? await this.read({ ...located, current: input.current })
      : await this.forDefinition({ ...located, current: input.current });
    const compiled = this.compiler.compile(
      input.definition,
      fetched.specOperations,
    );

    return {
      compiled,
      reading: compiled.ok
        ? fetched.reading.withSkipped([
            ...fetched.reading.skipped,
            ...compiled.skipped,
          ])
        : null,
    };
  }

  private async forDefinition(input: {
    teamId: TeamId;
    integration: Integration;
    spec: ApiSpec;
    current: SpecFetchResult | null;
  }): Promise<SpecForDefinition> {
    const stored = await this.storedFor(input.current, input.spec);

    if (input.current && stored && !input.current.problem) {
      return {
        reading: input.current.withSkipped(stored.skipped),
        specOperations: { hash: stored.hash, operations: stored.operations },
      };
    }

    return this.read(input);
  }

  private async storedFor(
    current: SpecFetchResult | null,
    spec: ApiSpec,
  ): Promise<SpecDocument | null> {
    return current?.isOf(spec) && current.hash
      ? this.documents.withHash(current.hash)
      : null;
  }

  private async read(input: {
    teamId: TeamId;
    integration: Integration;
    spec: ApiSpec;
    current: SpecFetchResult | null;
  }): Promise<SpecForDefinition> {
    const read = await this.reader.read(
      input.spec,
      await this.callAuthResolver.of(input.teamId, input.integration),
    );
    const readAt = this.clock.now();

    if (read.kind === 'unread') {
      const stored = await this.storedFor(input.current, input.spec);

      return input.current && stored
        ? {
            reading: input.current
              .stillAfter(read.problem)
              .withSkipped(stored.skipped),
            specOperations: {
              hash: stored.hash,
              operations: stored.operations,
            },
          }
        : {
            reading: SpecFetchResult.failed({
              spec: input.spec,
              readAt,
              problem: read.problem,
            }),
            specOperations: null,
          };
    }

    const document =
      (await this.documents.withHash(read.hash)) ??
      (await this.saved(
        SpecDocument.read({
          hash: read.hash,
          kind: input.spec.kind,
          operations: read.operations,
          skipped: read.skipped,
          readAt,
        }),
      ));

    return {
      reading: SpecFetchResult.read({
        spec: input.spec,
        hash: document.hash,
        readAt,
        skipped: document.skipped,
      }),
      specOperations: { hash: document.hash, operations: document.operations },
    };
  }

  private async saved(document: SpecDocument): Promise<SpecDocument> {
    await this.documents.save(document);

    return document;
  }
}
