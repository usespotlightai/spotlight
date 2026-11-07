import { CatalogModule } from '@catalog/catalog.module';
import { IdentityModule } from '@identity/identity.module';
import { ENABLED_AT_STATIONS } from '@lines/application/ports/enabled-at-stations.port';
import { LINE_IMAGES } from '@lines/application/ports/line-images.port';
import { LINE_RESOURCES } from '@lines/application/ports/line-resources.port';
import { LINES } from '@lines/application/ports/lines.port';
import { LINES_CONTROLLERS, LINES_PROVIDERS } from '@lines/lines.wiring';
import { Module } from '@nestjs/common';

@Module({
  imports: [IdentityModule, CatalogModule],
  controllers: [...LINES_CONTROLLERS],
  providers: [...LINES_PROVIDERS],
  exports: [LINES, LINE_RESOURCES, LINE_IMAGES, ENABLED_AT_STATIONS],
})
export class LinesModule {}
