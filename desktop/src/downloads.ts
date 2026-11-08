import { existsSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { app, type Session } from 'electron';

export const freeName = (
  name: string,
  taken: (candidate: string) => boolean,
): string => {
  const safe = basename(name).replace(/[/\\:]/g, '-') || 'download';

  if (!taken(safe)) {
    return safe;
  }

  const extension = extname(safe);
  const stem = safe.slice(0, safe.length - extension.length);

  for (let number = 1; ; number += 1) {
    const candidate = `${stem} (${number})${extension}`;

    if (!taken(candidate)) {
      return candidate;
    }
  }
};

export const saveDownloadsToDownloads = (session: Session) => {
  session.on('will-download', (_event, item) => {
    const folder = app.getPath('downloads');
    const path = join(
      folder,
      freeName(item.getFilename(), (candidate) =>
        existsSync(join(folder, candidate)),
      ),
    );

    item.setSavePath(path);
    item.once('done', (_done, state) => {
      if (state === 'completed') {
        app.dock?.downloadFinished(path);
      }
    });
  });
};
