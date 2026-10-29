import type { WorkPort } from '@replays/application/ports/work.port';
import {
  ReflectionNoticeWording,
  UnreflectedStallWording,
} from '@replays/application/rendering/reflection-notice';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import {
  type ReflectionNotice,
  reflectionNotice,
} from '@replays/domain/services/reflection-notice';

export class SearchFindings {
  constructor(private readonly work: WorkPort) {}

  async findingsOf(search: Search): Promise<readonly string[]> {
    const notice = this.newestNoticeOf(search);

    if (notice) {
      return ReflectionNoticeWording.pointsOf(
        notice,
        await this.titlesOf(search, notice),
      );
    }

    return search.stopReason === 'stalled'
      ? UnreflectedStallWording.points
      : [];
  }

  async stallFixesOf(search: Search): Promise<readonly string[]> {
    if (search.stopReason !== 'stalled') {
      return [];
    }

    const ending = [...search.iterations]
      .reverse()
      .find((each) => each.reflects && each.endedSearch);
    const notice = ending ? reflectionNotice(ending) : null;

    return notice && notice.fixes.length > 0
      ? ReflectionNoticeWording.fixesOf(
          notice,
          await this.titlesOf(search, notice),
        )
      : [];
  }

  private newestNoticeOf(search: Search): ReflectionNotice | null {
    for (const each of [...search.iterations].reverse()) {
      const notice = each.reflects ? reflectionNotice(each) : null;

      if (notice) {
        return notice;
      }
    }

    return null;
  }

  private async titlesOf(
    search: Search,
    notice: ReflectionNotice,
  ): Promise<ReadonlyMap<string, string | null>> {
    return new Map(
      (
        await this.work.runSummaries(
          search.workspaceId,
          notice.fixes.map((each) => each.originalRunId),
        )
      ).map((each) => [each.runId.value, each.title] as const),
    );
  }
}
