import type {
  KnownToolDto,
  OnboardingDto,
} from '@application/dto/onboarding.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { GitHubAppPort } from '@application/ports/github-app.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { OnboardingQuery } from '@application/queries/onboarding.query';
import { shownFor } from '@application/services/setup-steps';
import {
  asSetupState,
  type TeamSetup,
} from '@application/services/team-setup.service';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { KNOWN_TOOLS } from '@domain/services/known-tools';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/**
 * What a team still has to do. Each step is something a person does
 * somewhere else, so they are asked about rather than assumed.
 */
export class OnboardingHandler
  implements QueryHandlerPort<OnboardingQuery, OnboardingDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly setup: TeamSetup,
    private readonly app: GitHubAppPort,
    private readonly lines: AssemblyLineRepository,
  ) {}

  async execute(query: OnboardingQuery): Promise<OnboardingDto | null> {
    try {
      const team = await this.workspaces.findTeamForMember(
        query.teamId,
        UserId.of(query.viewerId),
      );

      if (!team) {
        return null;
      }

      const [facts, installUrl, lines] = await Promise.all([
        this.setup.factsFor(
          WorkspaceId.of(team.workspaceId),
          TeamId.of(team.teamId),
        ),
        this.app.installUrl(),
        this.lines.ofTeam(TeamId.of(team.teamId)),
      ]);

      // The account a team's repositories are named under, so a person naming
      // one types only the part that is theirs. Null until it has a connection.
      const repositoryOwner = facts.installation
        ? await this.app.owner(facts.installation)
        : null;

      return {
        steps: shownFor(asSetupState(facts), {
          slug: team.slug,
          teamId: team.teamId,
        }),
        installUrl,
        connectedToGitHub: facts.connectedToGitHub,
        configRepository: facts.configRepository,
        repositoryOwner,
        lines: lines.map((line) => ({
          key: line.key.value,
          name: line.name.value,
          harness: line.worked[0]?.harness?.value ?? null,
          repositories: line.repositories.all.map((each) => each.value),
        })),
        tools: KNOWN_TOOLS.map(
          (each): KnownToolDto => ({
            source: each.source.value,
            name: each.name,
            summary: each.summary,
            secretCalled: each.secretCalled,
            chosen: facts.listening.includes(each.source.value),
          }),
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
