import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import {
  configurationHome,
  teamConfig,
} from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { eq } from 'drizzle-orm';

const APPLIED = {
  teamId: teamConfig.teamId,
  repository: teamConfig.repository,
  files: teamConfig.files,
};

type Row = {
  teamId: string;
  repository: string;
  files: { path: string; text: string }[];
};

const applied = (row: Row): Applied => ({
  teamId: TeamId.of(row.teamId),
  repository: Repository.of(row.repository),
  files: row.files.map((each) => ConfigurationFile.of(each.path, each.text)),
});

@Injectable()
export class DrizzleAppliedConfigurationReader
  implements AppliedConfigurationPort
{
  constructor(private readonly context: DrizzleContext) {}

  async of(teamId: TeamId): Promise<Applied | null> {
    const [found] = await this.context.db
      .select(APPLIED)
      .from(teamConfig)
      .where(eq(teamConfig.teamId, teamId.value))
      .limit(1);

    return found ? applied(found) : null;
  }

  async everywhere(): Promise<readonly Applied[]> {
    return (await this.context.db.select(APPLIED).from(teamConfig)).map(
      applied,
    );
  }

  async keptIn(teamId: TeamId): Promise<Repository | null> {
    const [found] = await this.context.db
      .select({ keptIn: configurationHome.keptIn })
      .from(configurationHome)
      .where(eq(configurationHome.teamId, teamId.value))
      .limit(1);

    return found?.keptIn ? Repository.of(found.keptIn) : null;
  }
}
