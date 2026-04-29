#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

function run(args, opts = {}) {
  execFileSync('git', args, {
    stdio: 'inherit',
    ...opts,
  });
}

function getEnv(name, fallback = '') {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : fallback;
}

function requireEnv(name) {
  const v = getEnv(name);
  if (!v) {
    console.error(`[git-flow] Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function withTokenIfProvided(url) {
  const token = getEnv('GIT_AUTH_TOKEN');
  if (!token || !url.startsWith('https://')) return url;

  const user = getEnv('GIT_AUTH_USER', 'x-access-token');
  const encodedUser = encodeURIComponent(user);
  const encodedToken = encodeURIComponent(token);
  return url.replace('https://', `https://${encodedUser}:${encodedToken}@`);
}

function parseAction() {
  const action = process.argv[2];
  if (!action || ['-h', '--help', 'help'].includes(action)) {
    console.log(`Usage: node scripts/git-flow.js <clone|push>\n\nRequired envs:\n  GIT_REPO_URL\n\nOptional envs:\n  GIT_BRANCH=main\n  GIT_CLONE_DIR=.cache/git-target\n  GIT_AUTH_TOKEN=...\n  GIT_AUTH_USER=x-access-token\n  GIT_COMMIT_MESSAGE='chore: update generated files'\n  GIT_ALLOW_EMPTY_COMMIT=false\n`);
    process.exit(0);
  }

  if (!['clone', 'push'].includes(action)) {
    console.error(`[git-flow] Invalid action: ${action}`);
    process.exit(1);
  }

  return action;
}

function cloneFlow() {
  const repoUrl = withTokenIfProvided(requireEnv('GIT_REPO_URL'));
  const branch = getEnv('GIT_BRANCH', 'main');
  const cloneDir = resolve(getEnv('GIT_CLONE_DIR', '.cache/git-target'));

  if (!existsSync(cloneDir)) {
    console.log(`[git-flow] Cloning ${branch} into ${cloneDir}`);
    run(['clone', '--branch', branch, '--single-branch', repoUrl, cloneDir]);
    return;
  }

  if (!existsSync(resolve(cloneDir, '.git'))) {
    console.error(`[git-flow] Directory exists but is not a git repository: ${cloneDir}`);
    process.exit(1);
  }

  console.log(`[git-flow] Repository already exists. Syncing ${branch} in ${cloneDir}`);
  run(['-C', cloneDir, 'fetch', 'origin', branch]);
  run(['-C', cloneDir, 'checkout', branch]);
  run(['-C', cloneDir, 'reset', '--hard', `origin/${branch}`]);
}

function pushFlow() {
  const branch = getEnv('GIT_BRANCH', 'main');
  const cloneDir = resolve(getEnv('GIT_CLONE_DIR', '.cache/git-target'));
  const allowEmpty = getEnv('GIT_ALLOW_EMPTY_COMMIT', 'false').toLowerCase() === 'true';
  const message = getEnv('GIT_COMMIT_MESSAGE', 'chore: automated update');

  if (!existsSync(resolve(cloneDir, '.git'))) {
    console.error(`[git-flow] Not a git repository: ${cloneDir}. Run clone first.`);
    process.exit(1);
  }

  run(['-C', cloneDir, 'add', '-A']);

  let hasChanges = true;
  try {
    execFileSync('git', ['-C', cloneDir, 'diff', '--cached', '--quiet'], { stdio: 'ignore' });
    hasChanges = false;
  } catch {
    hasChanges = true;
  }

  if (!hasChanges && !allowEmpty) {
    console.log('[git-flow] No staged changes. Skipping commit/push.');
    return;
  }

  const commitArgs = ['-C', cloneDir, 'commit', '-m', message];
  if (allowEmpty && !hasChanges) commitArgs.push('--allow-empty');
  run(commitArgs);
  run(['-C', cloneDir, 'push', 'origin', branch]);
}

function main() {
  const action = parseAction();
  if (action === 'clone') cloneFlow();
  if (action === 'push') pushFlow();
}

main();
