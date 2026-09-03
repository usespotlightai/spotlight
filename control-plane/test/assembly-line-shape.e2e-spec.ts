import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '@/app.module';
import { AssemblyLine } from '@/domain/aggregates/assembly-line.aggregate';
import { BUILT_IN_STATIONS } from '@/domain/services/built-in-stations';
import { AssemblyLineName } from '@/domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@/domain/value-objects/factory-id.vo';
import { WorkspaceId } from '@/domain/value-objects/workspace-id.vo';
import type { DrizzleDatabase } from '@/infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@/infrastructure/persistence/drizzle/drizzle.constants';
import { DrizzleAssemblyLineRepository } from '@/infrastructure/persistence/drizzle/repositories/assembly-line.repository';
import { factory } from '@/infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  team,
  workspace,
} from '@/infrastructure/persistence/drizzle/schemas/workspace.schema';

/**
 * A line is its stations, and the database has to hold all of them — the ways
 * out included. Read back through the repository, so a column nobody wrote or
 * a table nobody joined is a failure here rather than a line that silently
 * offers its agents nowhere to go.
 */
describe('a line, written and read back (e2e)', () => {
  let app: INestApplication;
  let lines: DrizzleAssemblyLineRepository;
  let db: DrizzleDatabase;
  const held = `shape_${Date.now()}`;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    lines = app.get(DrizzleAssemblyLineRepository);
    db = app.get(DRIZZLE);

    // A line stands in a factory, in a team, in a workspace. Only the line is
    // under test, so the rest is the shortest thing that satisfies it.
    await db.insert(workspace).values({ id: held, name: held, slug: held });
    await db
      .insert(team)
      .values({ id: held, workspaceId: held, key: 'team', name: held });
    await db
      .insert(factory)
      .values({ id: held, workspaceId: held, teamId: held });
  });

  afterEach(async () => {
    await db.delete(workspace).where(eq(workspace.id, held));
    await app.close();
  });

  it('holds every station, its ways out and what it waits for', async () => {
    let next = 0;
    const opened = AssemblyLine.open({
      workspaceId: WorkspaceId.of(held),
      factoryId: FactoryId.of(held),
      name: AssemblyLineName.of('Shape'),
      newId: () => `${held}_${++next}`,
    });

    await lines.add(opened);
    const read = await lines.find(opened.id);

    const shapeOf = (line: AssemblyLine) =>
      line.stations.map((station) => ({
        name: station.name.value,
        kind: station.kind,
        ends: station.wayOut.ends,
        passesTo: station.wayOut.stations
          .map((id) => line.stationAt(id)?.name.value)
          .sort(),
      }));

    // Named by station rather than by id, so a line read back is compared
    // with the one that was opened rather than with its own identifiers.
    const reactionsOf = (line: AssemblyLine) =>
      line.reactions
        .map((each) => ({
          happening: each.happening.value,
          from: each.from ? line.stationAt(each.from)?.name.value : null,
          to: line.stationAt(each.to)?.name.value,
        }))
        .sort((a, b) => a.happening.localeCompare(b.happening));

    expect(read).not.toBeNull();
    expect(shapeOf(read as AssemblyLine)).toEqual(shapeOf(opened));
    expect(reactionsOf(read as AssemblyLine)).toEqual(reactionsOf(opened));
    expect(reactionsOf(opened)).not.toHaveLength(0);
    expect(read?.stations.map((each) => each.name.value)).toEqual(
      BUILT_IN_STATIONS.map((each) => each.name.value),
    );
  });
});
