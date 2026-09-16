import type { LineConfigReaderPort } from '@application/ports/line-config-reader.port';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { ConfigurationTarget } from '@application/services/configuration-target.service';
import type { HeldConfiguration } from '@application/services/held-configuration.service';
import type { WriteConfiguration } from '@application/services/write-configuration.service';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { Repository } from '@domain/value-objects/repository.vo';

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
    private readonly reader: LineConfigReaderPort,
    private readonly target: ConfigurationTarget,
    private readonly held: HeldConfiguration,
    private readonly writing: WriteConfiguration,
  ) {}

  async seed(
    workspace: Workspace,
    into: Repository,
    lines: readonly Line[],
  ): Promise<OpenedPullRequestDto | null> {
    const files = lines.flatMap((line) => this.reader.write(line));

    if (files.length === 0) {
      return null;
    }

    const target = this.target.at(workspace, into);
    const holding = target ? await this.held.at(target) : null;

    if (!target || !holding || holding.files.length > 0) {
      return null;
    }

    return this.writing.writeInto(target, {
      title: TITLE,
      body: BODY,
      files,
    });
  }
}
