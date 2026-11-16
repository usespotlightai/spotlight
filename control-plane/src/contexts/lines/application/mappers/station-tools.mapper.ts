import type { StationToolDto } from '@lines/application/dto/line.dto';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

export const StationToolsMapper = {
  toDtos(
    direct: readonly string[],
    skills: readonly string[],
    skillTools: ReadonlyMap<string, readonly string[]>,
  ): StationToolDto[] {
    const viaSkills = new Map<string, string[]>(
      direct.map((each) => [each, []]),
    );
    const directValues = new Set(direct);

    for (const skill of skills) {
      for (const value of skillTools.get(skill) ?? []) {
        const named = viaSkills.get(value) ?? [];
        if (!named.includes(skill)) {
          named.push(skill);
        }
        viaSkills.set(value, named);
      }
    }

    return [...viaSkills].map(([value, named]) => {
      const tool = Tool.of(value);

      return {
        value,
        called: tool.called,
        origin: tool.origin,
        direct: directValues.has(value),
        skills: named,
      };
    });
  },
};
