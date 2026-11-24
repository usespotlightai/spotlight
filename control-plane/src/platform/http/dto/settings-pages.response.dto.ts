import { ApiProperty } from '@nestjs/swagger';
import {
  SETTINGS_PAGE_GROUPS,
  SETTINGS_PAGE_ROLES,
  type SettingsPage,
} from '@platform/config/settings-pages';

export class SettingsPageDto {
  @ApiProperty({
    example: 'billing',
    description: 'The id of the page in its path, /settings/x/{id}',
  })
  readonly id: string;

  @ApiProperty({
    example: 'Billing',
    description: 'The text of the page in the sidebar, and its title',
  })
  readonly label: string;

  @ApiProperty({
    enum: SETTINGS_PAGE_GROUPS,
    enumName: 'SettingsPageGroup',
    example: 'workspace',
    description: 'The sidebar group of the page',
  })
  readonly group: SettingsPage['group'];

  @ApiProperty({
    enum: SETTINGS_PAGE_ROLES,
    enumName: 'SettingsPageRole',
    isArray: true,
    example: ['owner'],
    description:
      'The workspace roles that see the page. The page must also check the role itself: this only hides it',
  })
  readonly roles: SettingsPage['roles'];

  @ApiProperty({
    example: '/billing/element.js',
    description:
      'The path on this origin of the module script that defines the element',
  })
  readonly script: string;

  @ApiProperty({
    example: 'x-billing-page',
    description: 'The name of the custom element that the page shows',
  })
  readonly element: string;

  constructor(page: SettingsPage) {
    this.id = page.id;
    this.label = page.label;
    this.group = page.group;
    this.roles = page.roles;
    this.script = page.script;
    this.element = page.element;
  }
}

export class SettingsPagesResponseDto {
  @ApiProperty({ type: [SettingsPageDto] })
  readonly pages: SettingsPageDto[];

  constructor(pages: readonly SettingsPage[]) {
    this.pages = pages.map((each) => new SettingsPageDto(each));
  }
}
