import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  DescribedSourceDto,
  IntegrationResourceDto,
} from '@integrations/application/dto/integration-resource.dto';
import type { IntegrationCompilerPort } from '@integrations/application/ports/integration-compiler.port';
import type { IntegrationRecord } from '@integrations/application/ports/integration-resources.port';
import { integrationAt } from '@integrations/application/rendering/integration-problems';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

const readingWarnings = (
  record: IntegrationRecord,
  source: DescribedSource,
): readonly ConfigurationProblem[] => {
  const reading = record.reading;
  const path = integrationAt(record.source);
  const warned = (at: FieldPath, reason: string) =>
    ConfigurationProblem.of({ path, at, reason, severity: 'warning' });

  if (!reading) {
    return [];
  }

  return [
    ...(reading.problem
      ? [
          warned(
            FieldPath.of([source.kind, source.readsUrl ? 'url' : 'document']),
            reading.problem,
          ),
        ]
      : []),
    ...reading.passedOver.map((each) =>
      warned(FieldPath.of([source.kind]), each),
    ),
  ];
};

export class IntegrationViews {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: IntegrationCompilerPort,
  ) {}

  async of(record: IntegrationRecord): Promise<IntegrationResourceDto | null> {
    const team = await this.teams.find(record.teamId);

    return team ? this.onTeam(record, team.key) : null;
  }

  onTeam(record: IntegrationRecord, teamKey: string): IntegrationResourceDto {
    const compiled = this.compiler.compile(record.definition);
    const source = compiled.ok ? compiled.source : null;
    const handWritten = compiled.ok
      ? compiled.integration.offers.map((each) => each.tool)
      : [];
    const described: DescribedSourceDto | null =
      source && record.reading
        ? {
            kind: source.kind,
            hash: record.generatedFrom,
            readAt: record.reading.readAt.toISOString(),
            problem: record.reading.problem,
            tools: record.offers.filter((each) => !handWritten.includes(each))
              .length,
          }
        : null;

    return {
      id: record.id,
      version: record.version,
      address: IntegrationAddress.of(
        teamKey,
        SourceKey.of(record.source),
      ).toString(),
      teamId: record.teamId.value,
      source: record.source,
      definition: record.definition,
      tools: Object.fromEntries(
        record.offers.map((tool) => [tool.slice(tool.indexOf('.') + 1), tool]),
      ),
      described,
      warnings: compiled.ok
        ? [
            ...compiled.warnings,
            ...(source ? readingWarnings(record, source) : []),
          ]
        : compiled.problems,
    };
  }
}
