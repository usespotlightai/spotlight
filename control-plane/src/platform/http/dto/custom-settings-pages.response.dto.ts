import { ApiProperty } from '@nestjs/swagger';
import {
  CUSTOM_SETTINGS_PAGE_GROUPS,
  type CustomSettingsPage,
} from '@platform/config/custom-settings-pages';
import { WORKSPACE_ROLE_NAMES } from '@shared-kernel/domain/value-objects/workspace-role-names';

export class CustomSettingsPageDto {
  @ApiProperty({
    example: 'handbook',
    description: 'The id of the page in its path, /settings/custom/{id}',
  })
  readonly id: string;

  @ApiProperty({
    example: 'Handbook',
    description: 'The text of the page in the sidebar, and its title',
  })
  readonly label: string;

  @ApiProperty({
    enum: CUSTOM_SETTINGS_PAGE_GROUPS,
    enumName: 'CustomSettingsPageGroup',
    example: 'workspace',
    description: 'The sidebar group of the page',
  })
  readonly group: CustomSettingsPage['group'];

  @ApiProperty({
    enum: WORKSPACE_ROLE_NAMES,
    isArray: true,
    example: ['owner'],
    description:
      'The workspace roles that see the page. The page must also check the role itself: this only hides it',
  })
  readonly roles: CustomSettingsPage['roles'];

  @ApiProperty({
    example: '/handbook/element.js',
    description:
      'The path on this origin of the module script that defines the element',
  })
  readonly script: string;

  @ApiProperty({
    example: 'x-handbook-page',
    description: 'The name of the custom element that the page shows',
  })
  readonly element: string;

  constructor(page: CustomSettingsPage) {
    this.id = page.id;
    this.label = page.label;
    this.group = page.group;
    this.roles = page.roles;
    this.script = page.script;
    this.element = page.element;
  }
}

export class CustomSettingsPagesResponseDto {
  @ApiProperty({ type: [CustomSettingsPageDto] })
  readonly pages: CustomSettingsPageDto[];

  constructor(pages: readonly CustomSettingsPage[]) {
    this.pages = pages.map((each) => new CustomSettingsPageDto(each));
  }
}
