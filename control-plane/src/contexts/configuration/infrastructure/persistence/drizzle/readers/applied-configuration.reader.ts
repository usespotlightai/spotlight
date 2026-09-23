import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import {
  INTEGRATIONS_UNDER,
  SKILLS_UNDER,
} from '@configuration/infrastructure/configuration-files';
import { teamConfig } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { eq } from 'drizzle-orm';

const APPLIED = {
  teamId: teamConfig.teamId,
  files: teamConfig.files,
};

type Row = {
  teamId: string;
  files: { path: string; text: string }[];
};

const applied = (row: Row): Applied => {
  const files = row.files.map((each) =>
    ConfigurationFile.of(each.path, each.text),
  );

  return {
    teamId: TeamId.of(row.teamId),
    integrations: files.filter(
      (each) => each.isUnder(INTEGRATIONS_UNDER) && /\.ya?ml$/.test(each.path),
    ),
    skills: files.filter((each) => each.isUnder(SKILLS_UNDER)),
  };
};

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
}
