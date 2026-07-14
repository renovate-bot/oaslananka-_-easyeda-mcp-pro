import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const renovateConfigPath = resolve(repoRoot, '.github/renovate.json');
const dependabotConfigPath = resolve(repoRoot, '.github/dependabot.yml');

interface RenovatePackageRule {
  matchManagers?: string[];
}

interface RenovateConfig {
  packageRules?: RenovatePackageRule[];
}

describe('dependency updater ownership', () => {
  it('uses Renovate as the only dependency update bot', () => {
    expect(existsSync(renovateConfigPath)).toBe(true);
    expect(existsSync(dependabotConfigPath)).toBe(false);
  });

  it('keeps GitHub Actions under Renovate management', () => {
    const config = JSON.parse(readFileSync(renovateConfigPath, 'utf8')) as RenovateConfig;
    const managesGitHubActions = config.packageRules?.some((rule) =>
      rule.matchManagers?.includes('github-actions'),
    );

    expect(managesGitHubActions).toBe(true);
  });
});
