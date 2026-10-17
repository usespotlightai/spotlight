import type {
  DescribedOperations,
  IntegrationCompilerPort,
  ParsedIntegration,
} from '@integrations/application/ports/integration-compiler.port';
import type { SourceReaderPort } from '@integrations/application/ports/source-reader.port';
import type { HostReach } from '@integrations/application/services/host-reach.service';
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
    private readonly hosts: HostReach,
    private readonly clock: ClockPort,
  ) {}

  async compiled(input: {
    definition: unknown;
    teamId: TeamId;
    standing: SourceReading | null;
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
      ? await this.read({ ...located, standing: input.standing })
      : await this.forDefinition({ ...located, standing: input.standing });
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
    standing: SourceReading | null;
  }): Promise<SourceForDefinition> {
    const kept = await this.keptFor(input.standing, input.source);

    if (input.standing && kept && !input.standing.problem) {
      return {
        reading: input.standing.passingOver(kept.passedOver),
        described: { hash: kept.hash, operations: kept.operations },
      };
    }

    return this.read(input);
  }

  private async keptFor(
    standing: SourceReading | null,
    source: DescribedSource,
  ): Promise<DescribedDocument | null> {
    return standing?.isOf(source) && standing.hash
      ? this.documents.withHash(standing.hash)
      : null;
  }

  private async read(input: {
    teamId: TeamId;
    integration: Integration;
    source: DescribedSource;
    standing: SourceReading | null;
  }): Promise<SourceForDefinition> {
    const read = await this.reader.read(
      input.source,
      await this.hosts.of(input.teamId, input.integration),
    );
    const readAt = this.clock.now();

    if (read.kind === 'unread') {
      const kept = await this.keptFor(input.standing, input.source);

      return input.standing && kept
        ? {
            reading: input.standing
              .stillAfter(read.problem)
              .passingOver(kept.passedOver),
            described: { hash: kept.hash, operations: kept.operations },
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
      (await this.kept(
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

  private async kept(document: DescribedDocument): Promise<DescribedDocument> {
    await this.documents.keep(document);

    return document;
  }
}
