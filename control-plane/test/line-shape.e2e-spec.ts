import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Line } from '@work/domain/aggregates/line.aggregate';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '@/app.module';

const BUILT_IN_STATIONS = BUILT_IN_LINES[0]?.stations ?? [];

import {
  team,
  workspace,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';

describe('a line, written and read back (e2e)', () => {
  let app: INestApplication;
  let lines: DrizzleLineRepository;
  let db: DrizzleDatabase;
  const held = `shape_${Date.now()}`;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    lines = app.get(DrizzleLineRepository);
    db = app.get(DRIZZLE);

    await db.insert(workspace).values({ id: held, name: held, slug: held });
    await db
      .insert(team)
      .values({ id: held, workspaceId: held, key: 'team', name: held });
  });

  afterEach(async () => {
    await db.delete(workspace).where(eq(workspace.id, held));
    await app.close();
  });

  it('holds every station, its ways out and what it waits for', async () => {
    let next = 0;
    const opened = Line.open({
      workspaceId: WorkspaceId.of(held),
      teamId: TeamId.of(held),
      line: BUILT_IN_LINES[0] as LineOpening,
      newId: () => `${held}_${++next}`,
    });

    await lines.add(opened);
    const read = await lines.find(opened.id);

    const shapeOf = (line: Line) =>
      line.stations.map((station) => ({
        name: station.name.value,
        kind: station.kind,
        ends: station.wayOut.ends,
        passesTo: station.wayOut.stations
          .map((id) => line.stationAt(id)?.name.value)
          .sort(),
      }));

    const reactionsOf = (line: Line) =>
      line.reactions
        .map((each) => ({
          happening: each.happening.value,
          from: each.from ? line.stationAt(each.from)?.name.value : null,
          to: line.stationAt(each.to)?.name.value,
        }))
        .sort((a, b) => a.happening.localeCompare(b.happening));

    expect(read).not.toBeNull();
    expect(shapeOf(read as Line)).toEqual(shapeOf(opened));
    expect(reactionsOf(read as Line)).toEqual(reactionsOf(opened));
    expect(reactionsOf(opened)).not.toHaveLength(0);
    expect(read?.stations.map((each) => each.name.value)).toEqual(
      BUILT_IN_STATIONS.map((each) => each.name.value),
    );
  });
});
