import { LabelColour } from '@domain/value-objects/label-colour.vo';
import { LabelId } from '@domain/value-objects/label-id.vo';
import { LabelName } from '@domain/value-objects/label-name.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export class Label {
  private constructor(
    readonly id: LabelId,
    readonly teamId: TeamId,
    readonly name: LabelName,
    readonly colour: LabelColour,
  ) {}

  static add(input: {
    id: LabelId;
    teamId: TeamId;
    name: LabelName;
    colour: LabelColour;
  }): Label {
    return new Label(input.id, input.teamId, input.name, input.colour);
  }

  static rehydrate(input: {
    id: LabelId;
    teamId: TeamId;
    name: LabelName;
    colour: LabelColour;
  }): Label {
    return new Label(input.id, input.teamId, input.name, input.colour);
  }

  renamed(name: LabelName): Label {
    return new Label(this.id, this.teamId, name, this.colour);
  }

  recoloured(colour: LabelColour): Label {
    return new Label(this.id, this.teamId, this.name, colour);
  }

  equals(other: Label): boolean {
    return this.id.equals(other.id);
  }
}
