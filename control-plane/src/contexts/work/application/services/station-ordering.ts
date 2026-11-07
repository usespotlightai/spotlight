import {
  RunSpecContract,
  type RunSpecShape,
  TRACE_PARENT_VAR,
} from '@runs/application/contracts/run-spec.contract';
import type {
  HarnessLaunchPort,
  PreparedHarness,
  SkillsHome,
} from '@runs/application/ports/harness-launch.port';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import { ReadyProfileMapper } from '@work/application/mappers/ready-profile.mapper';
import { ReadySkillMapper } from '@work/application/mappers/ready-skill.mapper';
import { skillFilesOf } from '@work/application/mappers/skill-files.mapper';
import type { BuiltInSkillsPort } from '@work/application/ports/built-in-skills.port';
import type { ContentHashPort } from '@work/application/ports/content-hash.port';
import type { StationProfilesPort } from '@work/application/ports/station-profiles.port';
import { Attached } from '@work/application/rendering/attached';
import type { RunCatalog } from '@work/application/services/run-catalog.service';
import type { StationSkills } from '@work/application/services/station-skills.service';
import { skillsForTools } from '@work/domain/services/enabled-for-run';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import {
  type OrderedAt,
  orderAt,
  type RunOrder,
} from '@work/domain/services/run-order';
import { RunReadying } from '@work/domain/services/run-readying';
import { stationConfigOf } from '@work/domain/services/station-config-of';
import { runCheckoutsOf } from '@work/domain/services/task-checkouts';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';
import type { Station } from '@work/domain/value-objects/station.vo';
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

const laidOut = (
  { order, prepared, home, folders }: Ordered,
  laid: Laid,
): RunSpecShape => ({
  checkouts: runCheckoutsOf(order.checkouts),
  command: prepared.command.started({ [TRACE_PARENT_VAR]: laid.naming }),
  briefing: laid.briefing,
  handover: {
    options: order.options.map((each) => each.word),
    noteLimit: order.noteLimit,
  },
  resume: RunSpecContract.resumeOf(order.resume),
  skills: skillFilesOf(folders, home),
  skillHomes: laid.skillHomes,
  attachments: Attached.shapes(laid.attachments),
  diffs: order.diffs,
  ...(order.check ? { check: order.check } : {}),
  ...(prepared.setup ? { harnessSetup: prepared.setup } : {}),
  settingFiles: laid.settingFiles,
});

export class StationOrdering {
  constructor(
    private readonly harnesses: HarnessCatalog,
    private readonly launch: HarnessLaunchPort,
    private readonly builtInSkills: BuiltInSkillsPort,
    private readonly teamSkills: StationSkills,
    private readonly catalog: RunCatalog,
    private readonly profiles: StationProfilesPort,
    private readonly hash: ContentHashPort,
  ) {}

  ordered(line: LineMap, at: OrderedAt): Promise<Ordered | null> {
    return this.orderedAs(line, at, RunReadying.asATaskRun);
  }

  orderedForTrial(line: LineMap, at: OrderedAt): Promise<Ordered | null> {
    return this.orderedAs(line, at, RunReadying.asATrial);
  }

  private async orderedAs(
    line: LineMap,
    at: OrderedAt,
    readying: RunReadying,
  ): Promise<Ordered | null> {
    const station = line.stationAt(at.stationId) ?? null;
    const teamSkills = station
      ? await this.teamSkills.readyAt(line, station)
      : [];
    const catalog = station
      ? await this.catalog.enabledAt(line, station)
      : null;
    const ready = [...teamSkills, ...(catalog?.skills ?? [])];
    const order = orderAt({
      at,
      line,
      harnesses: this.harnesses,
      ready: ready.map(ReadySkillMapper.toReady),
      profiles: await this.profilesAt(line, station),
      denied:
        station && catalog ? readying.denied(station, catalog.denied) : [],
    });

    if (!order) {
      return null;
    }

    const prepared = this.preparedAs(order, readying);

    if (!prepared) {
      return null;
    }

    const home = this.launch.skillsFor(order.harness);

    if (!home) {
      return null;
    }

    return {
      station,
      order,
      prepared,
      home,
      folders: [
        ...order.enabled.builtInSkills.flatMap((key) => {
          const folder = this.builtInSkills.named(key.value);
          return folder ? [folder] : [];
        }),
        ...order.enabled.teamSkills.flatMap((skill) =>
          ready.filter((each) => each.skill.key === skill.key.value),
        ),
      ],
      catalogTools: catalog?.tools ?? [],
    };
  }

  async profilesAt(
    line: LineMap,
    station: Station | null,
  ): Promise<readonly ReadyProfile[]> {
    const shape = station?.profile
      ? await this.profiles.named(line.teamId, station.profile.value)
      : null;

    return shape ? [ReadyProfileMapper.toReady(shape)] : [];
  }

  prepared(order: RunOrder): PreparedHarness | null {
    return this.preparedAs(order, RunReadying.asATaskRun);
  }

  private preparedAs(
    order: RunOrder,
    readying: RunReadying,
  ): PreparedHarness | null {
    const profile = order.enabled.profile;

    return this.launch.preparedFor(order.harness, {
      model: order.model,
      effort: order.effort,
      profile: profile && readying.profile(profile),
    });
  }

  configuredAs(
    { station, order, folders }: Ordered,
    line: LineMap,
  ): StationConfig | null {
    return station
      ? stationConfigOf({ station, line, order, folders }, (text) =>
          this.hash.sha256(text),
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
  ): RunSpecShape {
    return laidOut(ordered, {
      ...input,
      skillHomes: this.launch.skillHomes(),
      settingFiles: this.launch.settingFiles(),
    });
  }
}
