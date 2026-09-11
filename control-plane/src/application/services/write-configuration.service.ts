import type {
  OpenedPullRequestDto,
  PullRequestPort,
} from '@application/ports/pull-request.port';
import type {
  ConfigurationRepo,
  ConfigurationTarget,
} from '@application/services/configuration-target.service';
import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';

export interface Writing {
  readonly branch: string;
  readonly title: string;
  readonly body: string;
  readonly files: readonly ConfigurationFile[];
  /** Paths the change takes away, written in the same commit. */
  readonly removes?: readonly string[];
}

/** Everything Spotlight writes to a team's configuration goes this way. */
export class WriteConfiguration {
  constructor(
    private readonly target: ConfigurationTarget,
    private readonly pullRequests: PullRequestPort,
  ) {}

  /** Null where there is nothing to write, or nowhere to write it yet. */
  async write(
    workspace: Workspace,
    team: Team,
    writing: Writing,
  ): Promise<OpenedPullRequestDto | null> {
    if (writing.files.length + (writing.removes?.length ?? 0) === 0) {
      return null;
    }

    const into = await this.target.of(workspace, team);

    return into ? this.writeInto(into, writing) : null;
  }

  /**
   * For a repository that is not the team's own target yet: one being set up,
   * or moved to. The caller guarantees there is something to write.
   */
  writeInto(
    into: ConfigurationRepo,
    writing: Writing,
  ): Promise<OpenedPullRequestDto> {
    return this.pullRequests.propose({
      installation: into.installation,
      repository: into.repository,
      branch: writing.branch,
      title: writing.title,
      body: writing.body,
      message: writing.title,
      files: writing.files.map((each) => ({
        path: each.path,
        text: each.text,
      })),
      removes: writing.removes ?? [],
    });
  }
}
