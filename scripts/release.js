'use strict';

const cp = require('node:child_process');
const path = require('node:path');
const pack = require('../package.json');

const releaseVersion = pack.version;
const releaseInfo = `${pack.name}@${releaseVersion}`;
console.log(`will release ${releaseInfo}...\n`);

function run(cmd) {
  console.log(`Run: ${cmd}`);
  const options = { cwd: path.join(__dirname, '..'), maxBuffer: 4 * 1024 * 1024, stdio: 'inherit' };
  cp.execSync(cmd, options);
}

// release tag
const tagName = `v${releaseVersion}`;
// run(`git tag -d ${tagName}`);
run(`git tag ${tagName}`);
run(`git push -f origin ${tagName}`);

// publish to npm
run('npm publish --registry=https://registry.npmjs.org');

console.log(`\nrelease ${releaseInfo} done.`);
