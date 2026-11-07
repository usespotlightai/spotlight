import { BUILT_IN_SKILL_KEY_LIST } from '@shared-kernel/domain/built-in-skills';
import type { RunOrder } from '@work/domain/services/run-order';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';

export interface ConfiguredSkillFolder {
  readonly skill: { readonly key: string };
  readonly files: readonly { readonly path: string; readonly text: string }[];
}

const byPath = (a: { path: string }, b: { path: string }): number =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

const isBuiltIn = (folder: ConfiguredSkillFolder): boolean =>
  BUILT_IN_SKILL_KEY_LIST.some((key) => key.value === folder.skill.key);

export const stationConfigOf = (
  {
    station,
    line,
    order,
    folders: allFolders,
  }: {
    station: Station;
    line: LineMap;
    order: RunOrder;
    folders: readonly ConfiguredSkillFolder[];
  },
  sha256: (text: string) => string,
): StationConfig => {
  const folders = allFolders.filter((each) => !isBuiltIn(each));
  const profile = order.enabled.profile;

  return StationConfig.of(
    {
      prompt: station.agentPrompt,
      harness: order.harness.value,
      model: order.model?.value ?? null,
      effort: order.effort?.value ?? null,
      profile: profile
        ? {
            key: profile.key.value,
            settings: {
              rules: profile.rules,
              mcpServers: profile.mcpServers.map((server) => ({
                ...server,
                env: Object.fromEntries(
                  Object.entries(server.env).map(([name, value]) => [
                    name,
                    sha256(value),
                  ]),
                ),
              })),
              native: profile.native,
            },
          }
        : null,
      image: line.image?.value ?? null,
      repositories: line.repositories.entries.map((each) => ({
        name: each.repository.name,
        setup: each.setup,
      })),
      skills: folders.map((folder) => ({
        key: folder.skill.key,
        hash: sha256(
          JSON.stringify(
            [...folder.files]
              .sort(byPath)
              .map((file) => [file.path, file.text]),
          ),
        ),
      })),
      tools: order.enabled.tools.map((each) => each.value),
      decisions: station.decisions,
      memories: station.memories,
      ...(station.judge
        ? {
            judge: {
              rubricHash: sha256(station.judge.criteria),
              sample: station.judge.sample,
              minAgreement: station.judge.minAgreement,
            },
          }
        : {}),
    },
    sha256,
  );
};
