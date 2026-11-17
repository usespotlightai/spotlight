import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BLOCKING = new Set(['high', 'critical']);

const exceptions = JSON.parse(
  readFileSync(new URL('../audit-exceptions.json', import.meta.url), 'utf8'),
);

const audited = () => {
  try {
    return execFileSync('npm', ['audit', '--omit=dev', '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    if (typeof error.stdout === 'string' && error.stdout.length > 0) {
      return error.stdout;
    }
    throw error;
  }
};

const advisoryOf = (url) => url.split('/').pop();

const report = JSON.parse(audited());
const found = new Map();

for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via === 'object' && BLOCKING.has(via.severity)) {
      found.set(advisoryOf(via.url), via);
    }
  }
}

const today = new Date().toISOString().slice(0, 10);
const excepted = new Map(
  exceptions
    .filter((exception) => exception.until >= today)
    .map((exception) => [exception.advisory, exception]),
);
const blocking = [...found].filter(([advisory]) => !excepted.has(advisory));

for (const [advisory, via] of found) {
  const exception = excepted.get(advisory);

  if (exception) {
    console.log(
      `Excepted until ${exception.until}: ${advisory} in ${via.name} (${via.severity}). ${exception.reason}`,
    );
  }
}

for (const exception of exceptions) {
  if (exception.until < today && found.has(exception.advisory)) {
    console.log(
      `::warning::The audit exception for ${exception.advisory} ended on ${exception.until}. Review it in .github/audit-exceptions.json.`,
    );
  }
}

for (const [advisory, via] of blocking) {
  console.log(
    `::error::${via.name} ${via.range}: ${via.title} (${via.severity}) ${via.url}`,
  );
}

if (blocking.length > 0) {
  process.exit(1);
}

console.log(
  `No ${[...BLOCKING].join(' or ')} vulnerabilities in production dependencies without an exception.`,
);
