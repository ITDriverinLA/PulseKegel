import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('Building server...');
execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=server_dist', {
  cwd: rootDir,
  stdio: 'inherit'
});

console.log('Copying templates...');
const templatesSource = join(rootDir, 'server', 'templates');
const templatesDest = join(rootDir, 'server_dist', 'templates');
if (existsSync(templatesSource)) {
  cpSync(templatesSource, templatesDest, { recursive: true });
  console.log('Templates copied successfully');
}

console.log('Copying public folder...');
const publicSource = join(rootDir, 'server', 'public');
const publicDest = join(rootDir, 'server_dist', 'public');
if (existsSync(publicSource)) {
  cpSync(publicSource, publicDest, { recursive: true });
  console.log('Public folder copied successfully');
}

console.log('Server build complete!');
