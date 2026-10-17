import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  ApiSpecDto,
  IntegrationResourceDto,
} from '@integrations/application/dto/integration-resource.dto';
import type { IntegrationCompilerPort } from '@integrations/application/ports/integration-compiler.port';
import type { IntegrationRecord } from '@integrations/application/ports/integration-resources.port';
import { integrationAt } from '@integrations/application/rendering/integration-problems';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

const readingWarnings = (
  record: IntegrationRecord,
  spec: ApiSpec,
): readonly ConfigurationProblem[] => {
  const reading = record.reading;
  const path = integrationAt(record.integration);
  const warned = (at: FieldPath, reason: string) =>
    ConfigurationProblem.of({ path, at, reason, severity: 'warning' });

  if (!reading) {
    return [];
  }

  return [
    ...(reading.problem
      ? [
          warned(
            FieldPath.of([spec.kind, spec.readsUrl ? 'url' : 'document']),
            reading.problem,
          ),
        ]
      : []),
    ...reading.skipped.map((each) => warned(FieldPath.of([spec.kind]), each)),
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
    const spec = compiled.ok ? compiled.spec : null;
    const handWritten = compiled.ok
      ? compiled.integration.tools.map((each) => each.tool)
      : [];
    const apiSpec: ApiSpecDto | null =
      spec && record.reading
        ? {
            kind: spec.kind,
            hash: record.generatedFrom,
            readAt: record.reading.readAt.toISOString(),
            problem: record.reading.problem,
            tools: record.tools.filter((each) => !handWritten.includes(each))
              .length,
          }
        : null;

    return {
      id: record.id,
      version: record.version,
      address: IntegrationAddress.of(
        teamKey,
        IntegrationKey.of(record.integration),
      ).toString(),
      teamId: record.teamId.value,
      integration: record.integration,
      definition: record.definition,
      tools: Object.fromEntries(
        record.tools.map((tool) => [tool.slice(tool.indexOf('.') + 1), tool]),
      ),
      spec: apiSpec,
      warnings: compiled.ok
        ? [...compiled.warnings, ...(spec ? readingWarnings(record, spec) : [])]
        : compiled.problems,
    };
  }
}
