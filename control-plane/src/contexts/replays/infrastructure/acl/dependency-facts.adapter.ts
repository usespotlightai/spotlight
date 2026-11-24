import type { TeamConfigurationPort } from '@configuration/application/ports/team-configuration.port';
import type {
  CheckedStation,
  DependencyFactsPort,
} from '@replays/application/ports/dependency-facts.port';
import type {
  CarriedSecret,
  DependencyFacts,
  SecretCarrier,
} from '@replays/domain/value-objects/dependency-facts';
import type {
  PlannedHook,
  PlannedIntegration,
} from '@replays/domain/value-objects/planned-changes.vo';
import type { SecretUsesPort } from '@secrets/application/ports/secret-uses.port';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

const CARRIERS: Readonly<Record<string, SecretCarrier>> = {
  'harness-profile': 'harness-profile',
  integration: 'integration',
};

const keyInTeam = (address: string, teamKey: string): string | null =>
  address.startsWith(`${teamKey}/`) ? address.slice(teamKey.length + 1) : null;

export class DependencyFactsReader implements DependencyFactsPort {
  constructor(
    private readonly uses: SecretUsesPort,
    private readonly configuration: TeamConfigurationPort,
  ) {}

  async of(
    station: CheckedStation,
    secrets: readonly SecretName[],
    hooks: readonly PlannedHook[],
    integrations: readonly PlannedIntegration[],
  ): Promise<DependencyFacts> {
    const [atStation, onMarks, skills, carried] = await Promise.all([
      this.configuration.hooksAt(station.teamId, station, hooks),
      this.configuration.enablingToolsOnMarks(integrations),
      secrets.length > 0 ? this.configuration.skills(station.teamId) : [],
      Promise.all(secrets.map((secret) => this.carriersOf(station, secret))),
    ]);

    return {
      hooks: atStation,
      onMarksAsPlanned: onMarks,
      secrets: [
        ...carried.flat(),
        ...secrets.flatMap((secret) =>
          skills
            .filter((skill) => skill.secrets.includes(secret.value))
            .map((skill) => ({
              secret,
              carrier: 'skill' as const,
              key: skill.key,
            })),
        ),
      ],
    };
  }

  private async carriersOf(
    station: CheckedStation,
    secret: SecretName,
  ): Promise<readonly CarriedSecret[]> {
    const uses = await this.uses.of({
      workspaceId: station.workspaceId.value,
      name: secret.value,
    });

    return uses.flatMap((use) => {
      const carrier = CARRIERS[use.kind];
      const key = keyInTeam(use.key, station.teamKey);

      return carrier && key ? [{ secret, carrier, key }] : [];
    });
  }
}
