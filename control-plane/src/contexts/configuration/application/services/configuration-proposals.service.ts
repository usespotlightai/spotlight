import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { ConfigurationTarget } from '@configuration/application/services/configuration-target.service';
import type { HeldConfiguration } from '@configuration/application/services/held-configuration.service';
import type { PendingConfiguration } from '@configuration/application/services/pending-configuration.service';
import type { WriteConfiguration } from '@configuration/application/services/write-configuration.service';
import type { ConfigurationHomeRepository } from '@configuration/domain/repositories/configuration-home.repository';
import type { OpenedPullRequestDto } from '@github/application/ports/pull-request.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  ConfigurationProposalsPort,
  Pending,
  Proposal,
} from '@work/application/ports/configuration-proposals.port';

const proposed = (opened: OpenedPullRequestDto) => ({
  url: opened.url,
});

export class ConfigurationProposals implements ConfigurationProposalsPort {
  constructor(
    private readonly teams: TeamsPort,
    private readonly homes: ConfigurationHomeRepository,
    private readonly target: ConfigurationTarget,
    private readonly held: HeldConfiguration,
    private readonly pending: PendingConfiguration,
    private readonly writing: WriteConfiguration,
  ) {}

  async pendingUnder(teamId: TeamId, path: string): Promise<Pending | null> {
    const team = await this.teams.find(teamId);
    const into = team ? await this.target.of(team) : null;

    return into ? this.pending.under(into, path) : null;
  }

  async propose(teamId: TeamId, proposal: Proposal) {
    const team = await this.teams.find(teamId);
    const into = team ? await this.target.of(team) : null;

    return into ? proposed(await this.writing.writeInto(into, proposal)) : null;
  }

  async seed(teamId: TeamId, proposal: Proposal) {
    if (proposal.files.length === 0) {
      return null;
    }

    const [team, home] = await Promise.all([
      this.teams.find(teamId),
      this.homes.find(teamId),
    ]);
    const into =
      team && home?.keptIn ? this.target.at(team, home.keptIn) : null;
    const holding = into ? await this.held.at(into) : null;

    if (!into || !holding || holding.files.length > 0) {
      return null;
    }

    return proposed(await this.writing.writeInto(into, proposal));
  }
}
