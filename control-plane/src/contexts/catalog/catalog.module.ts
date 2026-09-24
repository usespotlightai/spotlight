import { CATALOG } from '@catalog/application/ports/catalog.port';
import {
  CATALOG_CONTROLLERS,
  CATALOG_PROVIDERS,
} from '@catalog/catalog.wiring';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [IdentityModule],
  controllers: [...CATALOG_CONTROLLERS],
  providers: [...CATALOG_PROVIDERS],
  exports: [CATALOG],
})
export class CatalogModule {}
