import type {
  DescribedOperations,
  IntegrationCompilerPort,
  ParsedIntegration,
} from '@integrations/application/ports/integration-compiler.port';
import type { SourceReaderPort } from '@integrations/application/ports/source-reader.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import { DescribedDocument } from '@integrations/domain/aggregates/described-document.aggregate';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { DescribedDocumentRepository } from '@integrations/domain/repositories/described-document.repository';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import { SourceReading } from '@integrations/domain/value-objects/source-reading.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface SourceForDefinition {
  readonly reading: SourceReading;
  readonly described: DescribedOperations | null;
}

export interface SourcedIntegration {
  readonly compiled: ParsedIntegration;
  readonly reading: SourceReading | null;
}

export class IntegrationSources {
  constructor(
    private readonly compiler: IntegrationCompilerPort,
    private readonly documents: DescribedDocumentRepository,
    private readonly reader: SourceReaderPort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly clock: ClockPort,
  ) {}

  async compiled(input: {
    definition: unknown;
    teamId: TeamId;
    current: SourceReading | null;
    rereading?: boolean;
  }): Promise<SourcedIntegration> {
    const first = this.compiler.compile(input.definition);

    if (!first.ok || !first.source) {
      return { compiled: first, reading: null };
    }

    const located = {
      teamId: input.teamId,
      integration: first.integration,
      source: first.source,
    };
    const sourced = input.rereading
      ? await this.read({ ...located, current: input.current })
      : await this.forDefinition({ ...located, current: input.current });
    const compiled = this.compiler.compile(input.definition, sourced.described);

    return {
      compiled,
      reading: compiled.ok
        ? sourced.reading.passingOver([
            ...sourced.reading.passedOver,
            ...compiled.passedOver,
          ])
        : null,
    };
  }

  private async forDefinition(input: {
    teamId: TeamId;
    integration: Integration;
    source: DescribedSource;
    current: SourceReading | null;
  }): Promise<SourceForDefinition> {
    const stored = await this.storedFor(input.current, input.source);

    if (input.current && stored && !input.current.problem) {
      return {
        reading: input.current.passingOver(stored.passedOver),
        described: { hash: stored.hash, operations: stored.operations },
      };
    }

    return this.read(input);
  }

  private async storedFor(
    current: SourceReading | null,
    source: DescribedSource,
  ): Promise<DescribedDocument | null> {
    return current?.isOf(source) && current.hash
      ? this.documents.withHash(current.hash)
      : null;
  }

  private async read(input: {
    teamId: TeamId;
    integration: Integration;
    source: DescribedSource;
    current: SourceReading | null;
  }): Promise<SourceForDefinition> {
    const read = await this.reader.read(
      input.source,
      await this.callAuthResolver.of(input.teamId, input.integration),
    );
    const readAt = this.clock.now();

    if (read.kind === 'unread') {
      const stored = await this.storedFor(input.current, input.source);

      return input.current && stored
        ? {
            reading: input.current
              .stillAfter(read.problem)
              .passingOver(stored.passedOver),
            described: { hash: stored.hash, operations: stored.operations },
          }
        : {
            reading: SourceReading.failed({
              source: input.source,
              readAt,
              problem: read.problem,
            }),
            described: null,
          };
    }

    const document =
      (await this.documents.withHash(read.hash)) ??
      (await this.saved(
        DescribedDocument.read({
          hash: read.hash,
          kind: input.source.kind,
          operations: read.operations,
          passedOver: read.passedOver,
          readAt,
        }),
      ));

    return {
      reading: SourceReading.read({
        source: input.source,
        hash: document.hash,
        readAt,
        passedOver: document.passedOver,
      }),
      described: { hash: document.hash, operations: document.operations },
    };
  }

  private async saved(document: DescribedDocument): Promise<DescribedDocument> {
    await this.documents.save(document);

    return document;
  }
}
