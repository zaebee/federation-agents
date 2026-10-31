type DependencyGroup = 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies';

const groups: DependencyGroup[] = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function specs(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [name, spec] of Object.entries(value)) {
    if (typeof spec === 'string') result[name] = spec;
  }
  return result;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const manifest: unknown = JSON.parse(await Bun.file('package.json').text());
const lockfile: unknown = Bun.JSONC.parse(await Bun.file('bun.lock').text());

if (!isRecord(manifest)) fail('package.json is not an object');
if (!isRecord(lockfile)) fail('bun.lock is not an object');
if (!isRecord(lockfile.workspaces)) fail('bun.lock has no workspaces section');

const root = lockfile.workspaces[''];
if (!isRecord(root)) fail('bun.lock has no root workspace entry');

const problems: string[] = [];

for (const group of groups) {
  const declared = specs(manifest[group]);
  const locked = specs(root[group]);

  for (const name of Object.keys(declared)) {
    if (!(name in locked)) {
      problems.push(`${group}: ${name} is declared in package.json but missing from bun.lock`);
    } else if (locked[name] !== declared[name]) {
      problems.push(`${group}: ${name} is "${locked[name]}" in bun.lock but "${declared[name]}" in package.json`);
    }
  }

  for (const name of Object.keys(locked)) {
    if (!(name in declared)) {
      problems.push(`${group}: ${name} is in bun.lock but not declared in package.json`);
    }
  }
}

if (problems.length > 0) {
  console.error('bun.lock is out of date with package.json:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("Run 'bun install' and commit the updated bun.lock.");
  process.exit(1);
}

console.log('bun.lock matches package.json');
