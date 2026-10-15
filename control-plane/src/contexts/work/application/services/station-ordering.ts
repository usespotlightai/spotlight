import {
  RunSpecContract,
  THROUGH_SPOTLIGHT,
  TRACE_PARENT_VAR,
} from '@work/application/contracts/run-spec.contract';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import { ReadyProfileMapper } from '@work/application/mappers/ready-profile.mapper';
import { ReadySkillMapper } from '@work/application/mappers/ready-skill.mapper';
import { skillFilesOf } from '@work/application/mappers/skill-files.mapper';
import { StationConfigMapper } from '@work/application/mappers/station-config.mapper';
import type { BuiltInSkillsPort } from '@work/application/ports/built-in-skills.port';
import type { ContentDigestPort } from '@work/application/ports/content-digest.port';
import type {
  HarnessLaunchPort,
  PreparedHarness,
  SkillsHome,
} from '@work/application/ports/harness-launch.port';
import type { StationProfilesPort } from '@work/application/ports/station-profiles.port';
import { Attached } from '@work/application/rendering/attached';
import type { StationCatalog } from '@work/application/services/station-catalog.service';
import type { StationSkills } from '@work/application/services/station-skills.service';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import { BUILT_IN_SKILL_KEYS } from '@work/domain/services/built-in-skills';
import { skillsForTools } from '@work/domain/services/given-to-run';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import {
  type OrderedAt,
  orderAt,
  type RunOrder,
} from '@work/domain/services/run-order';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { CatalogWithheld } from '@work/domain/value-objects/catalog-withheld.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import {
  type ReadyProfile,
  withoutServers,
} from '@work/domain/value-objects/ready-profile';
import type { RunSpecParts } from '@work/domain/value-objects/run-spec.vo';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';

export interface Ordered {
  readonly station: Station | null;
  readonly order: RunOrder;
  readonly prepared: PreparedHarness;
  readonly home: SkillsHome;
  readonly folders: readonly ReadySkillFolder[];
  readonly catalogTools: readonly DeclaredTool[];
}

export interface Laid {
  readonly briefing: string;
  readonly naming: string;
  readonly attachments: readonly Attachment[];
  readonly skillHomes: readonly string[];
  readonly settingFiles: readonly string[];
}

// Do not send a host address to a runner. Name each remote as Spotlight serves it.
const laidOut = (
  { order, prepared, home, folders }: Ordered,
  laid: Laid,
): RunSpecParts => ({
  checkouts: order.checkouts.map((checkout) => ({
    remote: THROUGH_SPOTLIGHT,
    path: checkout.repository.name,
    ...(checkout.branch ? { branch: checkout.branch.value } : {}),
    ...(checkout.ref ? { ref: checkout.ref } : {}),
    ...(checkout.diffOf === 'commits' ? { diffOf: checkout.diffOf } : {}),
    ...(checkout.setup ? { setup: checkout.setup.value } : {}),
  })),
  command: prepared.command.started({ [TRACE_PARENT_VAR]: laid.naming }),
  briefing: laid.briefing,
  handover: {
    options: order.options.map((each) => each.word),
    noteLimit: order.noteLimit,
  },
  continuity: RunSpecContract.continuityOf(order.continuity),
  skills: skillFilesOf(folders, home),
  skillHomes: laid.skillHomes,
  attachments: Attached.shapes(laid.attachments),
  diffs: order.diffs,
  ...(order.check ? { check: order.check.value } : {}),
  ...(prepared.setup ? { harnessSetup: prepared.setup } : {}),
  settingFiles: laid.settingFiles,
});

interface Readying {
  withheld(
    station: Station,
    withheld: readonly CatalogWithheld[],
  ): readonly CatalogWithheld[];
  profile(profile: ReadyProfile): ReadyProfile;
}

const AS_A_TASK_RUN: Readying = {
  withheld: (_station, withheld) => withheld,
  profile: (profile) => profile,
};

const AS_A_REPLAY: Readying = {
  withheld: (station, withheld) =>
    withheld.filter(
      (each) => !station.tools.some((tool) => tool.value === each.id),
    ),
  profile: withoutServers,
};

export class StationOrdering {
  constructor(
    private readonly harnesses: HarnessCatalog,
    private readonly launch: HarnessLaunchPort,
    private readonly builtInSkills: BuiltInSkillsPort,
    private readonly teamSkills: StationSkills,
    private readonly catalog: StationCatalog,
    private readonly profiles: StationProfilesPort,
    private readonly digest: ContentDigestPort,
  ) {}

  ordered(line: Line, at: OrderedAt): Promise<Ordered | null> {
    return this.orderedAs(line, at, AS_A_TASK_RUN);
  }

  orderedForReplay(line: Line, at: OrderedAt): Promise<Ordered | null> {
    return this.orderedAs(line, at, AS_A_REPLAY);
  }

  private async orderedAs(
    line: Line,
    at: OrderedAt,
    readying: Readying,
  ): Promise<Ordered | null> {
    const station = line.stationAt(at.stationId) ?? null;
    const kept = station ? await this.teamSkills.readyAt(line, station) : [];
    const catalog = station ? await this.catalog.givenAt(line, station) : null;
    const ready = [...kept, ...(catalog?.skills ?? [])];
    const order = orderAt({
      at,
      line,
      harnesses: this.harnesses,
      ready: ready.map(ReadySkillMapper.toReady),
      profiles: await this.profilesAt(line, station),
      withheld:
        station && catalog ? readying.withheld(station, catalog.withheld) : [],
    });

    if (!order) {
      return null;
    }

    const prepared = this.preparedAs(order, readying);

    if (!prepared) {
      return null;
    }

    const home = this.launch.skillsFor(order.harness.id);

    if (!home) {
      return null;
    }

    return {
      station,
      order,
      prepared,
      home,
      folders: [
        ...order.given.builtInSkills.flatMap((key) => {
          const folder = this.builtInSkills.named(key.value);
          return folder ? [folder] : [];
        }),
        ...order.given.teamSkills.flatMap((skill) =>
          ready.filter((each) => each.skill.key === skill.key.value),
        ),
      ],
      catalogTools: catalog?.tools ?? [],
    };
  }

  async profilesAt(
    line: Line,
    station: Station | null,
  ): Promise<readonly ReadyProfile[]> {
    const shape = station?.profile
      ? await this.profiles.named(line.teamId, station.profile.value)
      : null;

    return shape ? [ReadyProfileMapper.toReady(shape)] : [];
  }

  prepared(order: RunOrder): PreparedHarness | null {
    return this.preparedAs(order, AS_A_TASK_RUN);
  }

  private preparedAs(
    order: RunOrder,
    readying: Readying,
  ): PreparedHarness | null {
    const profile = order.given.profile;

    return this.launch.preparedFor(order.harness.id, {
      model: order.model,
      effort: order.effort,
      profile: profile && readying.profile(profile),
    });
  }

  configuredAs(
    { station, order, folders }: Ordered,
    line: Line,
  ): StationConfig | null {
    return station
      ? StationConfigMapper.configuredAs(
          {
            station,
            line,
            order,
            folders: folders.filter(
              (each) =>
                !BUILT_IN_SKILL_KEYS.some(
                  (key) => key.value === each.skill.key,
                ),
            ),
          },
          this.digest,
        )
      : null;
  }

  equipped(ordered: Ordered, described: readonly DeclaredTool[]): Ordered {
    const added = skillsForTools(described).flatMap((key) => {
      const folder = ordered.folders.some(
        (each) => each.skill.key === key.value,
      )
        ? null
        : this.builtInSkills.named(key.value);
      return folder ? [folder] : [];
    });

    return added.length > 0
      ? { ...ordered, folders: [...ordered.folders, ...added] }
      : ordered;
  }

  laid(
    ordered: Ordered,
    input: Pick<Laid, 'briefing' | 'naming' | 'attachments'>,
  ): RunSpecParts {
    return laidOut(ordered, {
      ...input,
      skillHomes: this.launch.skillHomes(),
      settingFiles: this.launch.settingFiles(),
    });
  }
}
