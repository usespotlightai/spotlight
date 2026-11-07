import { isDeepStrictEqual } from 'node:util';
import type {
  RunFactOwner,
  RunFactsPort,
} from '@insights/application/ports/run-facts.port';
import type {
  RunFact,
  TaskPullRequestFact,
} from '@insights/domain/value-objects/run-fact.vo';
import {
  type RunFactRow,
  rowOfFact,
} from '@insights/infrastructure/persistence/drizzle/mappers/run-fact.mapper';
import {
  runFact,
  runRecord,
  taskPullRequestFact,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { inList } from '@platform/persistence/drizzle/in-list';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, getTableColumns, gte, sql } from 'drizzle-orm';
import { union } from 'drizzle-orm/pg-core';

const replaced = Object.fromEntries(
  Object.entries(getTableColumns(runFact))
    .filter(([key]) => key !== 'runId')
    .map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)]),
);

const ownedBy = (owner: RunFactOwner) =>
  owner.kind === 'team'
    ? and(
        eq(runFact.workspaceId, owner.workspaceId.value),
        eq(runFact.teamId, owner.teamId.value),
      )
    : eq(runFact.workspaceId, owner.workspaceId.value);

const comparable = (row: RunFactRow): unknown =>
  JSON.parse(JSON.stringify(row));

@Injectable()
export class DrizzleRunFacts implements RunFactsPort {
  constructor(private readonly context: DrizzleContext) {}

  async lockTasks(taskIds: readonly TaskId[]): Promise<void> {
    const keys = [...new Set(taskIds.map((each) => each.value))]
      .sort()
      .map((each) => `run-fact:${each}`);

    if (keys.length === 0) {
      return;
    }

    await this.context.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(key, 0)) from unnest(array[${sql.join(
        keys.map((key) => sql`${key}`),
        sql`, `,
      )}]::text[]) with ordinality as locked(key, at) order by at`,
    );
  }

  async put(facts: readonly RunFact[]): Promise<void> {
    if (facts.length === 0) {
      return;
    }

    await this.context.db
      .insert(runFact)
      .values(facts.map(rowOfFact))
      .onConflictDoUpdate({ target: runFact.runId, set: replaced });
  }

  async drop(runIds: readonly RunId[]): Promise<void> {
    if (runIds.length === 0) {
      return;
    }

    await this.context.db.delete(runFact).where(
      inList(
        runFact.runId,
        runIds.map((each) => each.value),
      ),
    );
  }

  async putTaskPullRequests(
    pullRequests: readonly TaskPullRequestFact[],
  ): Promise<void> {
    for (const each of pullRequests) {
      const columns = {
        workspaceId: each.workspaceId.value,
        teamId: each.teamId.value,
        pullRequest: each.pullRequest.value,
        state: each.state,
        openedAt: each.openedAt,
        firstReviewAt: each.firstReviewAt,
        closedAt: each.closedAt,
      };

      await this.context.db
        .insert(taskPullRequestFact)
        .values({ taskId: each.taskId.value, ...columns })
        .onConflictDoUpdate({
          target: taskPullRequestFact.taskId,
          set: columns,
        });
    }
  }

  async dropTaskPullRequests(taskIds: readonly TaskId[]): Promise<void> {
    if (taskIds.length === 0) {
      return;
    }

    await this.context.db.delete(taskPullRequestFact).where(
      inList(
        taskPullRequestFact.taskId,
        taskIds.map((each) => each.value),
      ),
    );
  }

  async runsOfTasks(taskIds: readonly TaskId[]): Promise<readonly RunId[]> {
    if (taskIds.length === 0) {
      return [];
    }

    return (
      await this.context.db
        .select({ runId: runFact.runId })
        .from(runFact)
        .where(
          inList(
            runFact.taskId,
            taskIds.map((each) => each.value),
          ),
        )
    ).map((each) => RunId.of(each.runId));
  }

  async tasksOfRuns(runIds: readonly RunId[]): Promise<readonly TaskId[]> {
    if (runIds.length === 0) {
      return [];
    }

    return (
      await this.context.db
        .selectDistinct({ taskId: runFact.taskId })
        .from(runFact)
        .where(
          inList(
            runFact.runId,
            runIds.map((each) => each.value),
          ),
        )
    ).map((each) => TaskId.of(each.taskId));
  }

  async runsOf(owner: RunFactOwner): Promise<readonly RunId[]> {
    return (
      await this.context.db
        .select({ runId: runFact.runId })
        .from(runFact)
        .where(ownedBy(owner))
    ).map((each) => RunId.of(each.runId));
  }

  async runsEndedSince(since: Date): Promise<readonly RunId[]> {
    return (
      await this.context.db
        .select({ runId: runFact.runId })
        .from(runFact)
        .where(gte(runFact.endedAt, since))
    ).map((each) => RunId.of(each.runId));
  }

  async differing(facts: readonly RunFact[]): Promise<readonly RunId[]> {
    if (facts.length === 0) {
      return [];
    }

    const stored = new Map(
      (
        await this.context.db
          .select()
          .from(runFact)
          .where(
            inList(
              runFact.runId,
              facts.map((each) => each.runId.value),
            ),
          )
      ).map((row) => [row.runId, comparable(row)]),
    );

    return facts.flatMap((fact) => {
      const known = stored.get(fact.runId.value);

      return known !== undefined &&
        isDeepStrictEqual(known, comparable(rowOfFact(fact)))
        ? []
        : [fact.runId];
    });
  }

  async workspaces(): Promise<readonly WorkspaceId[]> {
    return (
      await union(
        this.context.db
          .selectDistinct({ workspaceId: runRecord.workspaceId })
          .from(runRecord),
        this.context.db
          .selectDistinct({ workspaceId: runFact.workspaceId })
          .from(runFact),
      )
    ).map((each) => WorkspaceId.of(each.workspaceId));
  }
}
