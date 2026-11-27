import {
  isJsonArray,
  isJsonObject,
  type JsonValue,
} from '@shared-kernel/domain/json-value';
import {
  commandsInScript,
  type ShellCommand,
  type ShellWord,
} from '@work/domain/services/shell-script';
import type { StepKind } from '@work/domain/value-objects/step-kind';

/** The commands of the spotlight CLI that a briefing tells the agent to run, and that its journal shows it ran. */
export const HANDOVER_COMMAND = 'spotlight handover';

export const REMEMBER_COMMAND = 'spotlight remember';

export const FORGET_COMMAND = 'spotlight forget';

export const DECIDE_COMMAND = 'spotlight decide';

const CLI = 'spotlight';

type ReasoningKind =
  | 'message'
  | 'thought'
  | 'planned'
  | 'handover'
  | 'remember';

type SpotlightCommandName = 'remember' | 'forget' | 'handover';

/** A spotlight command that a step of a run ran. */
export interface SpotlightCommand {
  readonly name: SpotlightCommandName;
  /**
   * What the CLI received as the prose it carries: the body it remembers, the reason it forgets, or the note it hands
   * over. Null where the script does not give it inline, such as `--body -` that reads it from stdin.
   */
  readonly argument: string | null;
  /** The command alone, as the script wrote it, without the rest of the script it ran in. */
  readonly shown: string;
}

export interface Reasoning {
  readonly kind: ReasoningKind;
  readonly text: string;
  /** Each spotlight command the step ran, in the order it ran them; none for a step that ran none. */
  readonly commands: readonly SpotlightCommand[];
}

const REASONING_KINDS: Partial<Record<StepKind, ReasoningKind>> = {
  message: 'message',
  thought: 'thought',
  planned: 'planned',
};

const COMMAND_KINDS: Record<SpotlightCommandName, ReasoningKind> = {
  remember: 'remember',
  forget: 'remember',
  handover: 'handover',
};

/** The flag of each command that carries its prose. */
const CARRIED_BY: Record<SpotlightCommandName, string> = {
  remember: 'body',
  forget: 'because',
  handover: 'note',
};

/** The values of a prose flag that make the CLI read the prose from stdin instead. */
const FROM_STDIN = new Set(['', '-', '/dev/stdin']);

const FLAG = /^--?([A-Za-z][\w-]*)(?:=([\s\S]*))?$/;

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);

const SHELL_SAFE = /^[\w@%+=:,./-]+$/;

const COMMAND_FIELD = /"command"\s*:\s*/;

const JSON_ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

const COMMAND_NAMES: readonly string[] = ['remember', 'forget', 'handover'];

const isCommandName = (name: string): name is SpotlightCommandName =>
  COMMAND_NAMES.includes(name);

/** The prose a flag gives the CLI, the last time the command gives it, as Go's flag package reads it. */
const argumentOf = (
  words: readonly ShellWord[],
  flag: string,
): string | null => {
  let carried: string | null = null;

  for (let at = 0; at < words.length; at += 1) {
    const word = words[at];

    if (!word || (word.value === '--' && word.known)) {
      break;
    }

    const parsed = FLAG.exec(word.value);
    if (!parsed) {
      continue;
    }

    const [, name, inline] = parsed;
    let given: string | null;

    if (inline === undefined) {
      const value = words[at + 1];
      at += 1;
      given = value?.known ? value.value : null;
    } else {
      given = word.known ? inline : null;
    }

    if (name === flag) {
      carried = given !== null && !FROM_STDIN.has(given) ? given : null;
    }
  }

  return carried;
};

const spotlightCommandOf = (
  script: string,
  command: ShellCommand,
  cutShort: boolean,
): SpotlightCommand | null => {
  const [program, name, ...rest] = command.words;
  const last = command.words[command.words.length - 1];

  if (
    !program ||
    !name ||
    !program.known ||
    !name.known ||
    program.value !== CLI ||
    !isCommandName(name.value)
  ) {
    return null;
  }

  return {
    name: name.value,
    argument:
      cutShort && last && last.end >= script.length
        ? null
        : argumentOf(rest, CARRIED_BY[name.value]),
    shown: script
      .slice(program.start, command.end)
      .replace(/[ \t]*\\\n[ \t]*/g, ' ')
      .trim(),
  };
};

const quoted = (word: string): string =>
  SHELL_SAFE.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`;

/** The script an argv runs: the one it hands a shell with `-c`, or the argv itself, quoted for the shell. */
const scriptOfArgv = (argv: readonly string[]): string => {
  const [program] = argv;
  const flag = argv.findIndex(
    (each, at) => at > 0 && /^-[a-z]*c[a-z]*$/.test(each),
  );
  const script = flag > 0 ? argv[flag + 1] : undefined;

  return program &&
    SHELLS.has(program.split('/').pop() ?? '') &&
    script !== undefined
    ? script
    : argv.map(quoted).join(' ');
};

interface Read {
  readonly value: string;
  /** Whether the text ends before the value does, as where the journal cut a tool's input short. */
  readonly cutShort: boolean;
  readonly end: number;
}

/** A JSON string from its opening quote to its closing one, or to where the text was cut short. */
const jsonStringAt = (text: string, from: number): Read => {
  let value = '';
  let at = from + 1;

  while (at < text.length) {
    const char = text.charAt(at);

    if (char === '"') {
      return { value, cutShort: false, end: at + 1 };
    }

    if (char !== '\\') {
      value += char;
      at += 1;
      continue;
    }

    const escape = text.charAt(at + 1);
    const simple = JSON_ESCAPES[escape];
    const hex = escape === 'u' ? text.slice(at + 2, at + 6) : '';

    if (simple !== undefined) {
      value += simple;
      at += 2;
    } else if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
      value += String.fromCharCode(parseInt(hex, 16));
      at += 6;
    } else {
      break;
    }
  }

  return { value, cutShort: true, end: text.length };
};

/** The strings of a JSON array up to its end, or to where the text was cut short, the cut one as far as it goes. */
const jsonStringsAt = (
  text: string,
  from: number,
): { strings: string[]; cutShort: boolean } => {
  const strings: string[] = [];
  let at = from + 1;

  while (at < text.length && text.charAt(at) !== ']') {
    if (text.charAt(at) === '"') {
      const read = jsonStringAt(text, at);

      strings.push(read.value);
      if (read.cutShort) {
        return { strings, cutShort: true };
      }
      at = read.end;
    } else {
      at += 1;
    }
  }

  return { strings, cutShort: false };
};

const scriptOfCommand = (command: JsonValue | undefined): string | null => {
  if (typeof command === 'string') {
    return command;
  }

  return isJsonArray(command) &&
    command.every((each) => typeof each === 'string')
    ? scriptOfArgv(command)
    : null;
};

interface Script {
  readonly script: string;
  readonly cutShort: boolean;
}

/**
 * The shell script a tool step ran: the `command` of its JSON input, as a string or as an argv, even where the
 * journal cut the input short; otherwise the text as it is.
 */
const shellOf = (text: string): Script => {
  const whole = { script: text, cutShort: false };

  if (!text.trimStart().startsWith('{')) {
    return whole;
  }

  try {
    const read: unknown = JSON.parse(text);
    const script = isJsonObject(read) ? scriptOfCommand(read.command) : null;

    return script === null ? whole : { script, cutShort: false };
  } catch {
    const field = COMMAND_FIELD.exec(text);
    const at = field ? field.index + field[0].length : -1;

    if (text.charAt(at) === '"') {
      const read = jsonStringAt(text, at);
      return { script: read.value, cutShort: read.cutShort };
    }

    if (text.charAt(at) !== '[') {
      return whole;
    }

    const { strings, cutShort } = jsonStringsAt(text, at);
    return { script: scriptOfArgv(strings), cutShort };
  }
};

/**
 * Each spotlight command a shell script runs, in order, read the way the shell and the CLI read it. Where the script
 * was cut short, the command it ends in carries no argument, since what it received is not all there.
 */
export const spotlightCommandsIn = (
  script: string,
  cutShort = false,
): readonly SpotlightCommand[] =>
  commandsInScript(script).flatMap((each) => {
    const command = spotlightCommandOf(script, each, cutShort);
    return command ? [command] : [];
  });

const firstIn = (text: string): Reasoning | null => {
  const { script, cutShort } = shellOf(text);
  const commands = spotlightCommandsIn(script, cutShort);
  const [first] = commands;

  return first
    ? { kind: COMMAND_KINDS[first.name], text: script, commands }
    : null;
};

const commanded = (step: {
  readonly text: string;
  readonly input?: string | null;
}): Reasoning | null =>
  firstIn(step.text) ?? (step.input ? firstIn(step.input) : null);

export const reasoningIn = (step: {
  readonly kind: StepKind;
  readonly text: string;
  readonly input?: string | null;
}): Reasoning | null => {
  if (!step.text.trim()) {
    return null;
  }

  if (step.kind === 'tool') {
    return commanded(step);
  }

  const kind = REASONING_KINDS[step.kind];
  return kind ? { kind, text: step.text, commands: [] } : null;
};
