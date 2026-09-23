import type { StandingDecisionsDto } from '@change-review/application/dto/decision.dto';
import { namedDisputes } from '@change-review/application/mappers/named-disputes';
import type { DecisionReaderPort } from '@change-review/application/ports/decision-reader.port';
import type { PeoplePort } from '@change-review/application/ports/people.port';
import type { WorkspacesPort } from '@change-review/application/ports/workspaces.port';
import type { ListStandingDecisionsQuery } from '@change-review/application/queries/list-standing-decisions.query';
import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const MOST_SETS = 50;

const refused = (reason: string): InvalidDecisionError =>
  new InvalidDecisionError(reason, 'decision lookup');

const timeOf = (raw: string | null): Date | null => {
  if (raw === null || raw.trim() === '') {
    return null;
  }

  const at = new Date(raw);

  if (Number.isNaN(at.getTime())) {
    throw refused('gives its times as ISO dates, as in 2026-09-21T09:30:00Z');
  }

  return at;
};

const withinOf = (
  paths: readonly string[],
  repository: Repository | null,
): string[] => {
  const given = paths.map((each) => each.trim()).filter(Boolean);

  if (given.length === 0) {
    return [];
  }

  if (!repository) {
    throw refused('names the repository its paths lie in');
  }

  return given.map((each) => {
    const parts = each.split('/').filter((part) => part && part !== '.');

    if (parts.length === 0 || parts.includes('..')) {
      throw refused(`names ${each}, which is not a path in the repository`);
    }

    return [repository.name, ...parts].join('/');
  });
};

export class ListStandingDecisionsHandler
  implements
    QueryHandlerPort<ListStandingDecisionsQuery, StandingDecisionsDto[] | null>
{
  constructor(
    private readonly workspaces: WorkspacesPort,
    private readonly decisions: DecisionReaderPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(
    query: ListStandingDecisionsQuery,
  ): Promise<StandingDecisionsDto[] | null> {
    try {
      const workspaceId = await this.workspaces.idOf(query.slug);

      if (
        !workspaceId ||
        !(await this.workspaces.mayView(UserId.of(query.viewerId), workspaceId))
      ) {
        return null;
      }

      const repository = query.repository?.trim()
        ? Repository.of(query.repository)
        : null;

      const found = await this.decisions.standing({
        workspaceId,
        repository,
        within: withinOf(query.paths, repository),
        since: timeOf(query.since),
        until: timeOf(query.until),
        most: MOST_SETS,
      });

      return Promise.all(
        found.map(async (each) => ({
          ...each,
          decisions: await namedDisputes(each.decisions, this.people),
        })),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
