import { Runner } from '@domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { runner } from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleRunnerRepository implements RunnerRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Runner): Promise<void> {
    await this.context.db.insert(runner).values({
      id: added.id.value,
      pool: added.pool,
      labels: added.labels,
    });
  }

  async touch(id: RunnerId, at: Date): Promise<void> {
    await this.context.db
      .update(runner)
      .set({ lastSeenAt: at })
      .where(eq(runner.id, id.value));
  }

  async find(id: RunnerId): Promise<Runner | null> {
    const [found] = await this.context.db
      .select()
      .from(runner)
      .where(eq(runner.id, id.value))
      .limit(1);

    return found
      ? Runner.register({
          id: RunnerId.of(found.id),
          pool: found.pool,
          labels: found.labels,
        })
      : null;
  }
}
