import { Label } from '@domain/aggregates/label.aggregate';
import type { LabelRepository } from '@domain/repositories/label.repository';
import { LabelColour } from '@domain/value-objects/label-colour.vo';
import { LabelId } from '@domain/value-objects/label-id.vo';
import { LabelName } from '@domain/value-objects/label-name.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import {
  label,
  taskLabel,
} from '@infrastructure/persistence/drizzle/schemas/label.schema';
import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

type Row = typeof label.$inferSelect;

const toLabel = (row: Row): Label =>
  Label.rehydrate({
    id: LabelId.of(row.id),
    teamId: TeamId.of(row.teamId),
    name: LabelName.of(row.name),
    colour: LabelColour.of(row.colour),
  });

@Injectable()
export class DrizzleLabelRepository implements LabelRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Label): Promise<void> {
    await this.context.db.insert(label).values({
      id: added.id.value,
      teamId: added.teamId.value,
      name: added.name.value,
      colour: added.colour.value,
    });
  }

  async save(saved: Label): Promise<void> {
    await this.context.db
      .update(label)
      .set({ name: saved.name.value, colour: saved.colour.value })
      .where(eq(label.id, saved.id.value));
  }

  async find(id: LabelId): Promise<Label | null> {
    const [found] = await this.context.db
      .select()
      .from(label)
      .where(eq(label.id, id.value))
      .limit(1);

    return found ? toLabel(found) : null;
  }

  async remove(id: LabelId): Promise<void> {
    await this.context.db.delete(label).where(eq(label.id, id.value));
  }

  async forTeam(teamId: TeamId): Promise<Label[]> {
    const rows = await this.context.db
      .select()
      .from(label)
      .where(eq(label.teamId, teamId.value));

    return rows.map(toLabel);
  }

  async forTask(taskId: TaskId): Promise<Label[]> {
    const rows = await this.context.db
      .select({ label })
      .from(label)
      .innerJoin(taskLabel, eq(taskLabel.labelId, label.id))
      .where(eq(taskLabel.taskId, taskId.value));

    return rows.map((row) => toLabel(row.label));
  }

  async forTasks(taskIds: string[]): Promise<Map<string, Label[]>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select({ label, taskId: taskLabel.taskId })
      .from(label)
      .innerJoin(taskLabel, eq(taskLabel.labelId, label.id))
      .where(inArray(taskLabel.taskId, taskIds));

    return rows.reduce((map, row) => {
      const existing = map.get(row.taskId) ?? [];
      map.set(row.taskId, [...existing, toLabel(row.label)]);
      return map;
    }, new Map<string, Label[]>());
  }

  async attachToTask(labelId: LabelId, taskId: TaskId): Promise<void> {
    await this.context.db
      .insert(taskLabel)
      .values({ labelId: labelId.value, taskId: taskId.value })
      .onConflictDoNothing();
  }

  async detachFromTask(labelId: LabelId, taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(taskLabel)
      .where(
        and(
          eq(taskLabel.labelId, labelId.value),
          eq(taskLabel.taskId, taskId.value),
        ),
      );
  }
}
