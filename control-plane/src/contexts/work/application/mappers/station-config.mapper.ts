import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { ContentHashPort } from '@work/application/ports/content-hash.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import type { RunOrder } from '@work/domain/services/run-order';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';

const byPath = (a: { path: string }, b: { path: string }): number =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

export const StationConfigMapper = {
  configuredAs(
    {
      station,
      line,
      order,
      folders,
    }: {
      station: Station;
      line: Line;
      order: RunOrder;
      folders: readonly ReadySkillFolder[];
    },
    hash: ContentHashPort,
  ): StationConfig {
    const profile = order.enabled.profile;

    return StationConfig.of(
      {
        prompt: station.agentPrompt?.value ?? null,
        harness: order.harness.id.value,
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
                      hash.sha256(value),
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
          setup: each.setup?.value ?? null,
        })),
        skills: folders.map((folder) => ({
          key: folder.skill.key,
          hash: hash.sha256(
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
                rubricHash: hash.sha256(station.judge.criteria),
                sample: station.judge.sample,
                minAgreement: station.judge.minAgreement,
              },
            }
          : {}),
      },
      (canonical) => hash.sha256(canonical),
    );
  },
};
