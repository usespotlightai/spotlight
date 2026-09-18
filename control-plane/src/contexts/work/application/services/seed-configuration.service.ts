import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ProposedChangeDto } from '@work/application/dto/proposed-change.dto';
import type { ConfigurationProposalsPort } from '@work/application/ports/configuration-proposals.port';
import type { LineConfigWriterPort } from '@work/application/ports/line-config-writer.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';

const TITLE = 'Set up Spotlight';

const BODY = `Spotlight has been connected to this workspace. This pull request
describes the lines your team will run — their stations, the harness that works
each one, and the repositories they work in.

Everything here is read from this repository. Change a station's prompt, add
one, or move where a word takes a task, and Spotlight picks it up on the next
push to the default branch.

Nothing runs until this is merged: merging is what puts these lines on the
board.`;

export class SeedConfiguration {
  constructor(
    private readonly writer: LineConfigWriterPort,
    private readonly proposals: ConfigurationProposalsPort,
  ) {}

  seed(
    teamId: TeamId,
    lines: readonly Line[],
  ): Promise<ProposedChangeDto | null> {
    return this.proposals.seed(teamId, {
      title: TITLE,
      body: BODY,
      files: lines.flatMap((line) => this.writer.write(line).files),
    });
  }
}
