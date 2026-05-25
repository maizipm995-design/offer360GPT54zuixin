import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const platformPackageMap = {
  'darwin:arm64': '@rolldown/binding-darwin-arm64',
  'darwin:x64': '@rolldown/binding-darwin-x64',
  'linux:arm64': '@rolldown/binding-linux-arm64-gnu',
  'linux:x64': '@rolldown/binding-linux-x64-gnu',
  'win32:arm64': '@rolldown/binding-win32-arm64-msvc',
  'win32:x64': '@rolldown/binding-win32-x64-msvc',
};

const platformKey = `${process.platform}:${process.arch}`;
const bindingPackage = platformPackageMap[platformKey];

if (!bindingPackage) {
  process.exit(0);
}

try {
  require.resolve(bindingPackage);
  process.exit(0);
} catch {}

const rolldownPackageJsonPath = require.resolve('rolldown/package.json', { paths: [repoRoot] });
const rolldownVersion = require(rolldownPackageJsonPath).version;
const result = spawnSync(
  'npm',
  ['install', '--no-save', `${bindingPackage}@${rolldownVersion}`],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
