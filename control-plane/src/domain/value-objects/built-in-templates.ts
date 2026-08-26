import { Template } from '@domain/entities/template.entity';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TemplateId } from '@domain/value-objects/template-id.vo';
import { TemplateName } from '@domain/value-objects/template-name.vo';

const template = (id: string, name: string, stations: string[]): Template =>
  Template.of({
    id: TemplateId.of(id),
    name: TemplateName.of(name),
    stations: stations.map((each) => StationName.of(each)),
  });

export const DEFAULT_TEMPLATE = template('default', 'Default', [
  'Triage',
  'Spec',
  'Implementation',
  'Code Review',
]);

export const BUILT_IN_TEMPLATES: readonly Template[] = [DEFAULT_TEMPLATE];
