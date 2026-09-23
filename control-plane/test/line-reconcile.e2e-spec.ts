import {
  team,
  workspace,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { reconcileLine } from '@work/domain/services/reconcile-line';
import {
  LinePlan,
  type StationPlan,
} from '@work/domain/value-objects/line-plan.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { station } from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '@/app.module';

const keyed = (line: Line, id: { value: string }): StationKey =>
  line.stations.find((each) => each.id.value === id.value)?.key as StationKey;

const planOf = (line: Line): StationPlan[] =>
  line.stations.map((each) => ({
    key: each.key,
    name: each.name,
    kind: each.kind,
    color: each.color,
    description: each.description,
    harness: each.harness,
    model: each.model,
    effort: each.effort,
    agentPrompt: each.agentPrompt,
    check: null,
    setup: null,
    diffs: false,
    decisions: false,
    tools: each.tools,
    skills: each.skills,
    passesTo: each.wayOut.stations.map((to) => keyed(line, to)),
    ends: each.wayOut.ends,
  }));

describe('a line reconciled with its file (e2e)', () => {
  let app: INestApplication;
  let lines: DrizzleLineRepository;
  let db: DrizzleDatabase;
  const held = `reconcile_${Date.now()}`;

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

  it('adds a station the file describes and drops one it no longer does', async () => {
    let next = 0;
    const newId = () => `${held}_${++next}`;
    const opened = Line.open({
      workspaceId: WorkspaceId.of(held),
      teamId: TeamId.of(held),
      line: BUILT_IN_LINES[0] as LineOpening,
      newId,
    });
    await lines.add(opened);

    const spec = StationKey.of('spec');
    const design = StationKey.of('design');
    const implementation = StationKey.of('implementation');
    const standing = planOf(opened);
    const stations = standing.flatMap((each): StationPlan[] => {
      if (each.key.equals(spec)) {
        return [
          {
            ...each,
            key: design,
            name: StationName.of('Design'),
            color: StationColor.of('#5c66d9'),
            tools: [],
            skills: [],
            passesTo: [implementation],
          },
        ];
      }
      return [
        {
          ...each,
          passesTo: each.passesTo.map((to) => (to.equals(spec) ? design : to)),
        },
      ];
    });

    const reconciled = reconcileLine({
      standing: opened,
      plan: LinePlan.of({
        key: opened.key,
        name: opened.name,
        stations,
        reactions: opened.reactions.map((each) => ({
          happening: each.happening,
          from: each.from ? keyed(opened, each.from) : null,
          to: keyed(opened, each.to),
        })),
        role: opened.role,
        repositories: opened.repositories.all,
      }),
      tasksStanding: new Map(),
      newId,
    });

    expect(reconciled.ok).toBe(true);
    if (!reconciled.ok) {
      return;
    }

    await lines.save(reconciled.line);
    const read = (await lines.find(opened.id)) as Line;
    const rows = await db
      .select({ key: station.key })
      .from(station)
      .where(eq(station.lineId, opened.id.value));

    const keys = standing.map((each) =>
      each.key.equals(spec) ? 'design' : each.key.value,
    );
    expect(read.stations.map((each) => each.key.value)).toEqual(keys);
    expect(rows.map((each) => each.key).sort()).toEqual([...keys].sort());
    expect(
      read.stations
        .find((each) => each.key.equals(design))
        ?.wayOut.stations.map((to) => keyed(read, to).value),
    ).toEqual(['implementation']);
  });
});
