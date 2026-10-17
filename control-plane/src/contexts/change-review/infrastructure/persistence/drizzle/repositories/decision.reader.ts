import type {
  DecisionDto,
  StandingDecisionsDto,
  TaskDecisionsDto,
} from '@change-review/application/dto/decision.dto';
import { ranked } from '@change-review/application/mappers/ranked-decisions';
import type {
  DecisionReaderPort,
  StandingSought,
} from '@change-review/application/ports/decision-reader.port';
import {
  type DecisionSetRow,
  draftedRunOf,
  mergeRowOf,
} from '@change-review/infrastructure/persistence/drizzle/repositories/decision-set.rows';
import {
  decision,
  decisionDispute,
  decisionSet,
} from '@change-review/infrastructure/persistence/drizzle/schemas/decision.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  type SQL,
  sql,
} from 'drizzle-orm';

type DecisionRow = typeof decision.$inferSelect;
type DisputeRow = typeof decisionDispute.$inferSelect;

const escaped = (path: string): string => path.replace(/[\\%_]/g, '\\$&');

const lies = (path: string, within: readonly string[]): boolean =>
  within.length === 0 ||
  within.some((each) => path === each || path.startsWith(`${each}/`));

const touching = (within: readonly string[]): SQL =>
  sql`exists (
    select 1 from ${decision}, jsonb_array_elements_text(${decision.paths}) as touched(path)
    where ${decision.setId} = ${decisionSet.id}
    and (${sql.join(
      within.map(
        (each) =>
          sql`touched.path = ${each} or touched.path like ${`${escaped(each)}/%`}`,
      ),
      sql` or `,
    )})
  )`;

const toDecision = (
  row: DecisionRow,
  disputes: readonly DisputeRow[],
): DecisionDto => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  why: row.why,
  alternatives: row.alternatives,
  paths: row.paths,
  steps: row.steps,
  disputes: disputes
    .filter((dispute) => dispute.decisionId === row.id)
    .map((dispute) => ({
      id: dispute.id,
      path: dispute.path,
      by: dispute.byUserId,
      byName: null,
      reason: dispute.reason,
      at: dispute.at,
    })),
});

const decisionsIn = (
  set: DecisionSetRow,
  decisions: readonly DecisionRow[],
  disputes: readonly DisputeRow[],
  kept: (row: DecisionRow) => boolean = () => true,
): DecisionDto[] =>
  ranked(
    decisions
      .filter((each) => each.setId === set.id && kept(each))
      .map((each) => toDecision(each, disputes)),
  );

@Injectable()
export class DrizzleDecisionReader implements DecisionReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async ofTask(taskId: TaskId): Promise<TaskDecisionsDto | null> {
    const [set] = await this.context.db
      .select()
      .from(decisionSet)
      .where(eq(decisionSet.taskId, taskId.value))
      .limit(1);

    if (!set) {
      return null;
    }

    const { decisions, disputes } = await this.decisionRowsOf([set.id]);

    return {
      runId: set.decidedIn,
      drafting: draftedRunOf(set) !== null,
      standing: set.standing,
      merge: mergeRowOf(set),
      decisions: decisionsIn(set, decisions, disputes),
    };
  }

  async standing(sought: StandingSought): Promise<StandingDecisionsDto[]> {
    const sets = await this.context.db
      .select()
      .from(decisionSet)
      .where(
        and(
          eq(decisionSet.workspaceId, sought.workspaceId.value),
          eq(decisionSet.standing, 'stands'),
          sought.repository
            ? eq(decisionSet.mergedRepository, sought.repository.value)
            : undefined,
          sought.since ? gte(decisionSet.mergedAt, sought.since) : undefined,
          sought.until ? lte(decisionSet.mergedAt, sought.until) : undefined,
          sought.within.length > 0 ? touching(sought.within) : undefined,
        ),
      )
      .orderBy(desc(decisionSet.mergedAt))
      .limit(sought.max);

    const { decisions, disputes } = await this.decisionRowsOf(
      sets.map((each) => each.id),
    );

    return sets.flatMap((set) => {
      const merge = mergeRowOf(set);

      if (!merge) {
        return [];
      }

      const matching = decisionsIn(set, decisions, disputes, (each) =>
        each.paths.some((path) => lies(path, sought.within)),
      );

      return matching.length > 0
        ? [
            {
              taskId: set.taskId,
              runId: set.decidedIn,
              repository: merge.repository,
              commit: merge.commit,
              mergedAt: merge.at,
              decisions: matching,
            },
          ]
        : [];
    });
  }

  private async decisionRowsOf(setIds: readonly string[]): Promise<{
    decisions: DecisionRow[];
    disputes: DisputeRow[];
  }> {
    if (setIds.length === 0) {
      return { decisions: [], disputes: [] };
    }

    const decisions = await this.context.db
      .select()
      .from(decision)
      .where(inArray(decision.setId, [...setIds]))
      .orderBy(asc(decision.position));
    const disputes =
      decisions.length > 0
        ? await this.context.db
            .select()
            .from(decisionDispute)
            .where(
              inArray(
                decisionDispute.decisionId,
                decisions.map((each) => each.id),
              ),
            )
            .orderBy(asc(decisionDispute.at))
        : [];

    return { decisions, disputes };
  }
}
