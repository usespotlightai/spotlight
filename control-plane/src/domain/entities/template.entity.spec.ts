import { Template } from '@domain/entities/template.entity';
import { InvalidTemplateStationsError } from '@domain/exceptions/invalid-template-stations.error';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TemplateId } from '@domain/value-objects/template-id.vo';
import { TemplateName } from '@domain/value-objects/template-name.vo';
import { describe, expect, it } from 'vitest';

const templateOf = (stations: string[]) =>
  Template.of({
    id: TemplateId.of('template_1'),
    name: TemplateName.of('Default'),
    stations: stations.map((each) => ({
      name: StationName.of(each),
      color: StationColor.of('#a3a8b0'),
      agentPrompt: null,
    })),
  });

describe('Template', () => {
  it('lists its stations in the order they were written', () => {
    const template = templateOf(['Triage', 'Spec', 'Implementation']);

    expect(template.stations.map((each) => each.name.value)).toEqual([
      'Triage',
      'Spec',
      'Implementation',
    ]);
  });

  it('refuses a blueprint with no stations at all', () => {
    expect(() => templateOf([])).toThrow(InvalidTemplateStationsError);
  });

  it('keeps the stations it was given out of later reach', () => {
    const stations = [
      {
        name: StationName.of('Triage'),
        color: StationColor.of('#a3a8b0'),
        agentPrompt: null,
      },
    ];
    const template = Template.of({
      id: TemplateId.of('template_1'),
      name: TemplateName.of('Default'),
      stations,
    });

    stations.push({
      name: StationName.of('Spec'),
      color: StationColor.of('#a3a8b0'),
      agentPrompt: null,
    });

    expect(template.stations).toHaveLength(1);
  });

  it('is the same template as another of the same id', () => {
    expect(templateOf(['Triage']).equals(templateOf(['Spec']))).toBe(true);
  });
});
