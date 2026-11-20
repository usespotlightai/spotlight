import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { NowhereToOpenAPullRequestError } from '@work/domain/exceptions/nowhere-to-open-a-pull-request.error';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';

export interface ChatPullRequestPlacement {
  readonly line: LineMap;
  readonly station: Station;
}

const keysOf = (lines: readonly LineMap[]): string =>
  lines.map((each) => each.key.value).join(', ') || 'none';

const placed = (line: LineMap): ChatPullRequestPlacement | null => {
  const station = line.pullRequestStation;

  return station ? { line, station } : null;
};

export const chatPullRequestPlacement = (
  lines: readonly LineMap[],
  repository: Repository,
  named: string | null,
): ChatPullRequestPlacement => {
  const lineNamed = named?.trim() || null;

  if (lineNamed) {
    const line = lines.find((each) => each.key.value === lineNamed);

    if (!line) {
      throw new NowhereToOpenAPullRequestError(
        `there is no line "${lineNamed}"; the lines are: ${keysOf(lines)}`,
      );
    }

    if (!line.names(repository)) {
      throw new NowhereToOpenAPullRequestError(
        `${line.name.value} does not work on ${repository.value}, so its agents would have no checkout of it`,
      );
    }

    const placement = placed(line);

    if (!placement) {
      throw new NowhereToOpenAPullRequestError(
        `no station of ${line.name.value} opens pull requests`,
      );
    }

    return placement;
  }

  const candidates = lines
    .filter((each) => each.names(repository))
    .flatMap((each) => placed(each) ?? []);

  if (candidates.length === 1 && candidates[0]) {
    return candidates[0];
  }

  throw new NowhereToOpenAPullRequestError(
    candidates.length === 0
      ? `no line that works on ${repository.value} has a station that opens pull requests; name a line with --line (the lines are: ${keysOf(lines)})`
      : `more than one line works on ${repository.value}; name one with --line (${keysOf(candidates.map((each) => each.line))})`,
  );
};
