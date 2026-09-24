import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  KeptRunner,
  KeptTrust,
  KeptWorkspaceRunners,
  RunnerResourcesPort,
} from '@runners/application/ports/runner-resources.port';
import type { Enrolment } from '@runners/domain/services/runner-drift';
import {
  runner,
  runnerTrust,
  workspaceRunners,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNull, type SQL } from 'drizzle-orm';

type TrustRow = typeof runnerTrust.$inferSelect;
type DeclaredRow = typeof workspaceRunners.$inferSelect;

const keptTrust = (row: TrustRow): KeptTrust => ({
  id: row.id,
  version: row.version,
  workspaceId: WorkspaceId.of(row.workspaceId),
  key: row.key,
  issuer: row.issuer,
  subject: row.subject,
  audience: row.audience,
  labels: row.labels,
});

const keptDeclared = (row: DeclaredRow): KeptWorkspaceRunners => ({
  id: row.id,
  version: row.version,
  workspaceId: WorkspaceId.of(row.workspaceId),
  runners: row.runners,
  trusts: row.trusts,
});

@Injectable()
export class DrizzleRunnerResources implements RunnerResourcesPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  runnerWithId(id: string): Promise<KeptRunner | null> {
    return this.runner(eq(runner.id, id));
  }

  runnerNamed(
    workspaceId: WorkspaceId,
    name: string,
  ): Promise<KeptRunner | null> {
    return this.runner(
      and(eq(runner.workspaceId, workspaceId.value), eq(runner.name, name)),
    );
  }

  async trustWithId(id: string): Promise<KeptTrust | null> {
    const [found] = await this.db
      .select()
      .from(runnerTrust)
      .where(eq(runnerTrust.id, id))
      .limit(1);

    return found ? keptTrust(found) : null;
  }

  async trustAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<KeptTrust | null> {
    const [found] = await this.db
      .select()
      .from(runnerTrust)
      .where(
        and(
          eq(runnerTrust.workspaceId, workspaceId.value),
          eq(runnerTrust.key, key),
        ),
      )
      .limit(1);

    return found ? keptTrust(found) : null;
  }

  async declaredWithId(id: string): Promise<KeptWorkspaceRunners | null> {
    const [found] = await this.db
      .select()
      .from(workspaceRunners)
      .where(eq(workspaceRunners.id, id))
      .limit(1);

    return found ? keptDeclared(found) : null;
  }

  async declaredIn(
    workspaceId: WorkspaceId,
  ): Promise<KeptWorkspaceRunners | null> {
    const [found] = await this.db
      .select()
      .from(workspaceRunners)
      .where(eq(workspaceRunners.workspaceId, workspaceId.value))
      .limit(1);

    return found ? keptDeclared(found) : null;
  }

  async enrolmentIn(workspaceId: WorkspaceId): Promise<Enrolment> {
    const [runners, trusts] = await Promise.all([
      this.db
        .select({ name: runner.name, trustKey: runnerTrust.key })
        .from(runner)
        .leftJoin(runnerTrust, eq(runnerTrust.id, runner.trustId))
        .where(
          and(
            eq(runner.workspaceId, workspaceId.value),
            isNull(runner.revokedAt),
          ),
        )
        .orderBy(runner.name),
      this.db
        .select({ key: runnerTrust.key })
        .from(runnerTrust)
        .where(eq(runnerTrust.workspaceId, workspaceId.value)),
    ]);

    return {
      runners,
      trusts: trusts.map((each) => each.key),
    };
  }

  private async runner(where: SQL | undefined): Promise<KeptRunner | null> {
    const [found] = await this.db
      .select({
        id: runner.id,
        revision: runner.revision,
        workspaceId: runner.workspaceId,
        name: runner.name,
        labels: runner.labels,
        trustKey: runnerTrust.key,
      })
      .from(runner)
      .leftJoin(runnerTrust, eq(runnerTrust.id, runner.trustId))
      .where(and(where, isNull(runner.revokedAt)))
      .limit(1);

    return found
      ? { ...found, workspaceId: WorkspaceId.of(found.workspaceId) }
      : null;
  }
}
