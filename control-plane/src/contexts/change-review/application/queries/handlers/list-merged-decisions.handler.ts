import type { MergedDecisionsDto } from '@change-review/application/dto/decision.dto';
import { namedDisputes } from '@change-review/application/mappers/named-disputes';
import type { DecisionReaderPort } from '@change-review/application/ports/decision-reader.port';
import type { PeoplePort } from '@change-review/application/ports/people.port';
import type { WorkspacesPort } from '@change-review/application/ports/workspaces.port';
import type { ListMergedDecisionsQuery } from '@change-review/application/queries/list-merged-decisions.query';
import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const MAX_SETS = 50;

const invalid = (subject: string, reason: string): InvalidDecisionError =>
  new InvalidDecisionError(reason, subject);

const timeOf = (raw: string | null): Date | null => {
  if (raw === null || raw.trim() === '') {
    return null;
  }

  const at = new Date(raw);

  if (Number.isNaN(at.getTime())) {
    throw invalid(
      'decision lookup time',
      'must be an ISO date, such as 2026-09-21T09:30:00Z',
    );
  }

  return at;
};

const withinOf = (
  paths: readonly string[],
  repository: Repository | null,
): string[] => {
  const requested = paths.map((each) => each.trim()).filter(Boolean);

  if (requested.length === 0) {
    return [];
  }

  if (!repository) {
    throw invalid('decision lookup by path', 'must name its repository');
  }

  return requested.map((each) => {
    const parts = each.split('/').filter((part) => part && part !== '.');

    if (parts.length === 0 || parts.includes('..')) {
      throw invalid(
        'decision lookup path',
        `must be inside the repository, not ${each}`,
      );
    }

    return [repository.name, ...parts].join('/');
  });
};

export class ListMergedDecisionsHandler
  implements
    QueryHandlerPort<ListMergedDecisionsQuery, MergedDecisionsDto[] | null>
{
  constructor(
    private readonly workspaces: WorkspacesPort,
    private readonly decisions: DecisionReaderPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(
    query: ListMergedDecisionsQuery,
  ): Promise<MergedDecisionsDto[] | null> {
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

      const found = await this.decisions.merged({
        workspaceId,
        repository,
        within: withinOf(query.paths, repository),
        since: timeOf(query.since),
        until: timeOf(query.until),
        max: MAX_SETS,
      });

      return Promise.all(
        found.map(async (each) => ({
          ...each,
          decisions: await namedDisputes(each.decisions, this.people),
        })),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
