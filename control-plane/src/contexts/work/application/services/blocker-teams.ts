import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskSummary } from '@work/application/ports/task-reader.port';
import type { WorkAccess } from '@work/application/services/work-access.service';

// The teams of the blocking tasks that the viewer sees, the team of the tasks always.
export const blockerTeamsSeen = async (
  access: Pick<WorkAccess, 'seesTeam'>,
  teamId: TeamId,
  viewer: UserId,
  summaries: readonly TaskSummary[],
): Promise<ReadonlySet<string>> => {
  const others = [
    ...new Set(
      summaries.flatMap((each) => each.blockedBy.map((one) => one.teamId)),
    ),
  ].filter((each) => each !== teamId.value);
  const seen = await Promise.all(
    others.map(async (each) =>
      (await access.seesTeam(TeamId.of(each), viewer)) ? [each] : [],
    ),
  );

  return new Set([teamId.value, ...seen.flat()]);
};
