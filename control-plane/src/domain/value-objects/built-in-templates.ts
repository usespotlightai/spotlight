import { Template } from '@domain/entities/template.entity';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TemplateId } from '@domain/value-objects/template-id.vo';
import { TemplateName } from '@domain/value-objects/template-name.vo';

const template = (
  id: string,
  name: string,
  stations: [string, string][],
): Template =>
  Template.of({
    id: TemplateId.of(id),
    name: TemplateName.of(name),
    stations: stations.map(([each, color]) => ({
      name: StationName.of(each),
      color: StationColor.of(color),
    })),
  });

export const DEFAULT_TEMPLATE = template('default', 'Default', [
  ['Backlog', '#a3a8b0'],
  ['Triage', '#93a1b5'],
  ['Spec', '#5c66d9'],
  ['Implementation', '#edc12b'],
  ['Code Review', '#56b98d'],
]);

export const BUILT_IN_TEMPLATES: readonly Template[] = [DEFAULT_TEMPLATE];
