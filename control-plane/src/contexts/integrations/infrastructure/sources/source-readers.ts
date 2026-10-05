import type { Reach } from '@integrations/application/ports/integration-runtime.port';
import type {
  SourceRead,
  SourceReaderPort,
} from '@integrations/application/ports/source-reader.port';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';

export class SourceReaders implements SourceReaderPort {
  constructor(
    private readonly descriptions: SourceReaderPort,
    private readonly servers: SourceReaderPort,
  ) {}

  read(source: DescribedSource, reach: Reach): Promise<SourceRead> {
    return source.kind === 'mcp'
      ? this.servers.read(source, reach)
      : this.descriptions.read(source, reach);
  }
}
