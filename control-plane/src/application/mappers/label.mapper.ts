import type { LabelDto } from '@application/dto/label.dto';
import type { Label } from '@domain/aggregates/label.aggregate';

export const LabelMapper = {
  toDto(label: Label): LabelDto {
    return {
      id: label.id.value,
      teamId: label.teamId.value,
      name: label.name.value,
      colour: label.colour.value,
    };
  },
};
