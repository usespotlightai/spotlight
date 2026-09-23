import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DefineLineCommand } from '@work/application/commands/define-line.command';
import type { DefinedLineDto } from '@work/application/dto/line-resource.dto';
import { Line } from '@work/domain/aggregates/line.aggregate';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '@/app.module';
import { definitionOf } from './support/line-definition';
import { seatTeam } from './support/team';

const BUILT_IN = BUILT_IN_LINES[0] as LineOpening;

const shapeOf = (line: Line) =>
  line.stations.map((station) => ({
    key: station.key.value,
    name: station.name.value,
    kind: station.kind,
    color: station.color.value,
    prompt: station.agentPrompt?.value ?? null,
    tools: station.tools.map((each) => each.value),
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

describe('a line, defined and read back (e2e)', () => {
  let app: INestApplication;
  let lines: DrizzleLineRepository;
  let db: DrizzleDatabase;
  let commands: CommandBus;
  let seat: Awaited<ReturnType<typeof seatTeam>>;
  const held = `shape-${Date.now()}`;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    lines = app.get(DrizzleLineRepository);
    db = app.get(DRIZZLE);
    commands = app.get(CommandBus);
    seat = await seatTeam(db, held);
  });

  afterEach(async () => {
    await seat.unseat();
    await app.close();
  });

  it('holds every station, its ways out and what it waits for, as its definition says', async () => {
    const defined = await commands.execute<
      DefineLineCommand,
      DefinedLineDto | null
    >(new DefineLineCommand(held, seat.owner, definitionOf(BUILT_IN)));

    if (!defined?.ok) {
      throw new Error(JSON.stringify(defined));
    }

    const read = (await lines.find(LineId.of(defined.line.id))) as Line;
    let next = 0;
    const opened = Line.open({
      workspaceId: WorkspaceId.of(held),
      teamId: TeamId.of(held),
      line: BUILT_IN,
      newId: () => `${held}_${++next}`,
    });

    expect(shapeOf(read)).toEqual(shapeOf(opened));
    expect(reactionsOf(read)).toEqual(reactionsOf(opened));
    expect(reactionsOf(read)).not.toHaveLength(0);
    expect(read.stations.map((each) => each.name.value)).toEqual(
      BUILT_IN.stations.map((each) => each.name.value),
    );
  });
});
