import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { buildOpenApiDocument } from '@platform/http/openapi';
import {
  documentsByAudience,
  routesOf,
} from '@platform/http/openapi-audiences';
import { AppModule } from '@/app.module';

const write = (name: string, document: unknown): void => {
  const target = resolve(__dirname, '..', name);
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`wrote ${target}`);
};

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  const routes = routesOf(app);
  await app.close();

  write('openapi.json', document);

  for (const [audience, filtered] of Object.entries(
    documentsByAudience(document, routes),
  )) {
    write(`openapi.${audience}.json`, filtered);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
