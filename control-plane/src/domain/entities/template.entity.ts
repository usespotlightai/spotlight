import { InvalidTemplateStationsError } from '@domain/exceptions/invalid-template-stations.error';
import type { StationName } from '@domain/value-objects/station-name.vo';
import type { TemplateId } from '@domain/value-objects/template-id.vo';
import type { TemplateName } from '@domain/value-objects/template-name.vo';

export class Template {
  private constructor(
    readonly id: TemplateId,
    readonly name: TemplateName,
    readonly stations: readonly StationName[],
  ) {}

  static of(input: {
    id: TemplateId;
    name: TemplateName;
    stations: readonly StationName[];
  }): Template {
    if (input.stations.length === 0) {
      throw new InvalidTemplateStationsError('must number at least one');
    }

    return new Template(input.id, input.name, [...input.stations]);
  }

  equals(other: Template): boolean {
    return this.id.equals(other.id);
  }
}
