import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { LearnedOutputRepository } from '@integrations/domain/repositories/learned-output.repository';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import type {
  OpeningSource,
  TeamIntegrationsPort,
} from '@work/application/ports/team-integrations.port';

export class TeamIntegrations implements TeamIntegrationsPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly reader: IntegrationReader,
    private readonly learned: LearnedOutputRepository,
  ) {}

  async offered(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly ToolDeclaration[]> {
    const declared = await this.reader.declared(
      await this.defined.ofTeam(teamId),
      tools,
    );
    const learned = await this.learned.ofTools(
      teamId,
      declared.map((each) => each.tool),
    );
    const shapes = new Map(
      learned.map((each) => [each.tool.value, each.shape.schema]),
    );

    return declared.map((each) => ({
      ...each,
      learnedOutput: shapes.get(each.tool) ?? null,
    }));
  }

  async opening(teamId: TeamId): Promise<readonly OpeningSource[]> {
    const { integrations } = this.reader.readable(
      await this.defined.ofTeam(teamId),
    );

    return integrations
      .filter((each) =>
        [...(each.webhook?.events ?? []), ...(each.poll?.events ?? [])].some(
          (event) => event.raise.opens !== null,
        ),
      )
      .map((each) => ({
        source: each.integration.source.value,
        name: each.integration.name,
        tryIt: each.onboarding?.tryIt ?? null,
        heard: each.onboarding?.heard ?? null,
        link: each.onboarding?.link ?? null,
      }));
  }
}
