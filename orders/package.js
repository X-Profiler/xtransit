'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { yarnToNpm } = require('synp');
const exists = promisify(fs.exists);
const readFile = promisify(fs.readFile);

let logger;

async function readPackage(pkgfile) {
  try {
    if (!await exists(pkgfile)) {
      return {};
    }

    const data = {};
    data.name = pkgfile;
    data.pkg = (await readFile(pkgfile, 'utf8')).trim();

    const projectDir = path.dirname(pkgfile);

    // lock file
    const lockfile = path.join(projectDir, 'package-lock.json');
    /* istanbul ignore else */
    if (await exists(lockfile)) {
      data.lock = (await readFile(lockfile, 'utf8')).trim();
      data.lockType = 'package-lock';
    } else if (await exists(path.join(projectDir, 'yarn.lock'))) {
      data.lock = yarnToNpm(projectDir).trim();
      data.lockType = 'yarn';
    } else {
      for (let directory = projectDir; directory; directory = path.dirname(directory)) {
        const pnpmLockfile = path.join(directory, 'pnpm-lock.yaml');
        if (await exists(pnpmLockfile) && (directory === projectDir || await exists(path.join(directory, 'pnpm-workspace.yaml')))) {
          data.lock = (await readFile(pnpmLockfile, 'utf8')).trim();
          data.lockType = 'pnpm';
          data.lockImporter = path.relative(directory, projectDir).split(path.sep).join('/') || '.';
          break;
        }
        if (path.dirname(directory) === directory) {
          break;
        }
      }
    }

    return data;
  } catch (err) /* istanbul ignore next */ {
    logger.error(`readPackage failed: ${err.stack}`);
    return {};
  }
}

function readPackages(packages) {
  const tasks = [];
  for (const pkgfile of packages) {
    tasks.push(readPackage(pkgfile));
  }
  return Promise.all(tasks);
}

exports = module.exports = async function() {
  const message = {
    type: 'package',
    data: { pkgs: [] },
  };

  const packages = this.packages;
  if (!packages.length) {
    return message;
  }
  const pkgs = await readPackages(packages);
  message.data = { pkgs };
  return message;
};

exports.init = async function() {
  logger = this.logger;
};

exports.interval = 60 * 60;
