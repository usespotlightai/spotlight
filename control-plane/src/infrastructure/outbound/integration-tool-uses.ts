import type {
  IntegrationToolsPort,
  ReachableTool,
  ToolContext,
} from '@application/ports/integration-tools.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { Line } from '@domain/aggregates/line.aggregate';
import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { Tool } from '@domain/value-objects/tool.vo';
import { value } from '@infrastructure/integrations/expression';
import type { ReadableIntegration } from '@infrastructure/integrations/integration.compile';
import type { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { OAuth2Access } from '@infrastructure/integrations/oauth2-access';
import { asJson, textOf } from '@infrastructure/integrations/templating';
import type { HttpOutbound } from '@infrastructure/outbound/http-outbound';
import { taskBinding } from '@infrastructure/outbound/task-bindings';

const plainJson = (output: unknown): unknown =>
  JSON.parse(asJson(output ?? null));

export class IntegrationToolUses implements IntegrationToolsPort {
  constructor(
    private readonly factories: FactoryRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: IntegrationReader,
    private readonly secrets: TeamSecretsPort,
    private readonly outbound: HttpOutbound,
    private readonly oauth2: OAuth2Access,
  ) {}

  async reach(
    tool: Tool,
    { task, line }: ToolContext,
  ): Promise<ReachableTool | null> {
    const read = await this.readableFor(line);
    const readable = read?.integrations.find((each) =>
      tool.isOfferedBy(each.integration.source),
    );
    const declared = readable?.integration.offers.find((each) =>
      each.tool.equals(tool),
    );
    const compiled = readable?.tools.get(tool.name);
    const action = compiled
      ? readable?.actions.get(compiled.action)
      : undefined;

    if (!read || !readable || !declared || !compiled || !action) {
      return null;
    }

    const bound = { task: taskBinding(task, line) };

    return {
      declared,
      defaultFor: (input) => {
        const written = compiled.inputs.find(
          (each) => each.name === input.name,
        )?.default;
        return written ? textOf(written, bound) : undefined;
      },
      call: async (inputs) => {
        const secret = {
          ...(await this.secrets.resolveAll(
            read.teamId,
            readable.integration.credentials,
          )),
        };
        const connection =
          action.auth?.kind === 'oauth2'
            ? await this.oauth2.token(read.teamId, readable)
            : null;
        const bindings = {
          ...bound,
          inputs: inputs.values,
          secret,
          ...(connection ? { connection } : {}),
        };

        const result = await this.outbound.run(action, bindings);

        if (!result.ok) {
          throw new UpstreamRefusedError(
            `using ${tool.value}`,
            `the integration answered ${result.status}: ${asJson(result.response ?? null).slice(0, 500)}`,
          );
        }

        return plainJson(
          compiled.output
            ? value(compiled.output, {
                ...bindings,
                response: result.response,
                status: result.status,
                capture: result.capture,
              })
            : result.capture,
        );
      },
    };
  }

  private async readableFor(line: Line): Promise<{
    teamId: TeamId;
    integrations: readonly ReadableIntegration[];
  } | null> {
    const factory = await this.factories.find(line.factoryId);
    const applied = factory
      ? await this.configurations.findFor(factory.teamId)
      : null;

    if (!factory || !applied) {
      return null;
    }

    return {
      teamId: factory.teamId,
      integrations: this.reader.readable(applied.under(INTEGRATIONS_UNDER))
        .integrations,
    };
  }
}
