import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  ApiSpecDto,
  IntegrationResourceDto,
} from '@integrations/application/dto/integration-resource.dto';
import type { IntegrationCompilerPort } from '@integrations/application/ports/integration-compiler.port';
import type { IntegrationRecord } from '@integrations/application/ports/integration-resources.port';
import { integrationAt } from '@integrations/application/rendering/integration-problems';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OfferedTools } from '@integrations/domain/value-objects/offered-tools.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
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
    const compiled = this.compiler.compile(record.definition, null);
    const tools = record.tools.map((tool) => ToolName.rehydrate(tool));
    const spec = compiled.ok ? compiled.spec : null;
    const apiSpec: ApiSpecDto | null =
      spec && record.reading
        ? {
            kind: spec.kind,
            hash: record.generatedFrom,
            readAt: record.reading.readAt.toISOString(),
            problem: record.reading.problem,
            tools: compiled.ok
              ? OfferedTools.listed(
                  compiled.integration,
                  tools,
                  record.generatedFrom
                    ? ContentHash.of(record.generatedFrom)
                    : null,
                ).generatedCount
              : record.tools.length,
          }
        : null;

    return {
      id: record.id,
      version: record.version,
      address: IntegrationAddress.of(
        teamKey,
        IntegrationKey.rehydrate(record.integration),
      ).toString(),
      teamId: record.teamId.value,
      integration: record.integration,
      definition: record.definition,
      tools: Object.fromEntries(tools.map((tool) => [tool.name, tool.value])),
      spec: apiSpec,
      warnings: compiled.ok
        ? [...compiled.warnings, ...(spec ? readingWarnings(record, spec) : [])]
        : compiled.problems,
    };
  }
}
