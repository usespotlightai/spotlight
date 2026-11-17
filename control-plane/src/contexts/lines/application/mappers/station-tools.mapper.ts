import type { StationToolDto } from '@lines/application/dto/line.dto';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

export const StationToolsMapper = {
  toDtos(
    direct: readonly string[],
    skills: readonly string[],
    skillTools: ReadonlyMap<string, readonly string[]>,
  ): StationToolDto[] {
    const values = new Set(direct);

    for (const skill of skills) {
      for (const value of skillTools.get(skill) ?? []) {
        values.add(value);
      }
    }

    return [...values].map((value) => {
      const tool = Tool.of(value);

      return { value, called: tool.called, origin: tool.origin };
    });
  },
};
