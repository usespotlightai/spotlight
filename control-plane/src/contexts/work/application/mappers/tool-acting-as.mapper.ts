import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ToolActingAsDto } from '@work/application/ports/integration-tool-calls.port';
import { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';

export const ToolActingAsMapper = {
  toActingAs(dto: ToolActingAsDto): ToolActingAs {
    return dto.actsAs === 'requester' && dto.personId
      ? ToolActingAs.person(UserId.of(dto.personId), dto.linkedAccount)
      : ToolActingAs.team(dto.linkedAccount);
  },

  toDto(actingAs: ToolActingAs): ToolActingAsDto {
    return {
      actsAs: actingAs.actsAs,
      personId: actingAs.personId?.value ?? null,
      linkedAccount: actingAs.linkedAccount,
    };
  },
};
