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
  kept: IntegrationRecord,
  source: DescribedSource,
): readonly ConfigurationProblem[] => {
  const reading = kept.reading;
  const path = integrationAt(kept.source);
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

  async of(kept: IntegrationRecord): Promise<IntegrationResourceDto | null> {
    const team = await this.teams.find(kept.teamId);

    return team ? this.onTeam(kept, team.key) : null;
  }

  onTeam(kept: IntegrationRecord, teamKey: string): IntegrationResourceDto {
    const compiled = this.compiler.compile(kept.definition);
    const source = compiled.ok ? compiled.source : null;
    const handWritten = compiled.ok
      ? compiled.integration.offers.map((each) => each.tool)
      : [];
    const described: DescribedSourceDto | null =
      source && kept.reading
        ? {
            kind: source.kind,
            hash: kept.generatedFrom,
            readAt: kept.reading.readAt.toISOString(),
            problem: kept.reading.problem,
            tools: kept.offers.filter((each) => !handWritten.includes(each))
              .length,
          }
        : null;

    return {
      id: kept.id,
      version: kept.version,
      address: IntegrationAddress.of(
        teamKey,
        SourceKey.of(kept.source),
      ).toString(),
      teamId: kept.teamId.value,
      source: kept.source,
      definition: kept.definition,
      tools: Object.fromEntries(
        kept.offers.map((tool) => [tool.slice(tool.indexOf('.') + 1), tool]),
      ),
      described,
      warnings: compiled.ok
        ? [
            ...compiled.warnings,
            ...(source ? readingWarnings(kept, source) : []),
          ]
        : compiled.problems,
    };
  }
}
