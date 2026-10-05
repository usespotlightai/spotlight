import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ToolActingAsDto } from '@work/application/ports/integration-tool-calls.port';
import { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';

export const ToolActingAsMapper = {
  toActingAs(dto: ToolActingAsDto): ToolActingAs {
    return dto.holder === 'person' && dto.personId
      ? ToolActingAs.person(UserId.of(dto.personId), dto.handle)
      : ToolActingAs.team(dto.handle);
  },

  toDto(actingAs: ToolActingAs): ToolActingAsDto {
    return {
      holder: actingAs.holder,
      personId: actingAs.personId?.value ?? null,
      handle: actingAs.handle,
    };
  },
};
