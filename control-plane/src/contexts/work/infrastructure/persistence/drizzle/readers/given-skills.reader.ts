import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  GivenSkill,
  GivenSkillsPort,
} from '@work/application/ports/given-skills.port';
import {
  line,
  station,
  stationSkill,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleGivenSkills implements GivenSkillsPort {
  constructor(private readonly context: DrizzleContext) {}

  onTeam(teamId: TeamId): Promise<readonly GivenSkill[]> {
    return this.context.db
      .select({
        skill: stationSkill.skill,
        line: line.key,
        station: station.key,
      })
      .from(stationSkill)
      .innerJoin(station, eq(station.id, stationSkill.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .where(eq(line.teamId, teamId.value))
      .orderBy(asc(line.key), asc(station.key), asc(stationSkill.skill));
  }
}
