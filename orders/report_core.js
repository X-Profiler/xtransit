/* istanbul ignore file */
'use strict';

const os = require('os');
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const { promisify } = require('util');
const getNodeExe = require('../common/exe');
const exec = promisify(cp.exec);
const exists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const access = promisify(fs.access);
const stat = promisify(fs.stat);
const realpath = promisify(fs.realpath);

const CORE_PATTERN = '/proc/sys/kernel/core_pattern';
const MAX_CORE_FILES = 500;
const REPORT_INTERVAL = 60;

// system
const isLinux = os.platform() === 'linux';
const isWindows = os.platform() === 'win32';
const isMacOS = os.platform() === 'darwin';

let logger;
let coredirs = isMacOS ? ['/cores'] : [];
let coreprefix = ['core'];

async function getNodePwd(pid) {
  let pwd;
  try {
    // linux
    if (isLinux) {
      const { stdout } = await exec(`cat /proc/${pid}/environ`);
      pwd = stdout.trim()
        .split('\u0000')
        .map(env => env.startsWith('PWD=') && env.split('=')[1])
        .filter(pwd => pwd);
      pwd = pwd[0];
    }

    // macos
    if (isMacOS) {
      const { stdout } = await exec(`lsof -a -d cwd -p ${pid} | grep cwd`);
      pwd = stdout.split(' ').pop().trim();
    }

    // not support windows
    if (isWindows) {
      pwd = null;
    }
  } catch (err) {
    logger.warn(`getNodePwd failed: ${err}`);
  }

  return pwd;
}

async function getNodePwds(titles) {
  let pwds = [];

  try {
    const nodeExe = await getNodeExe(process.pid);
    const file = path.join(__dirname, '../commands/get_node_processes.js');
    const cmd = `${nodeExe} ${JSON.stringify(file)}`;
    const { stdout } = await exec(cmd, {
      encoding: 'utf8',
      stdio: 'ignore',
      env: Object.assign({
        XTRANSIT_TITLES: JSON.stringify(titles),
      }, process.env),
    });

    pwds = await Promise.all(
      stdout
        .split('\n')
        .filter(proc => proc)
        .map(proc => proc.split('\u0000')[0])
        .filter(pid => pid)
        .map(pid => getNodePwd(pid))
    );

    pwds = Array.from(new Set(pwds.filter(pwd => pwd)));
  } catch (err) {
    logger.error(`getNodePwds failed: ${err}`);
  }

  return pwds;
}

async function findCoreFile(coredir) {
  const corefiles = [];

  try {
    if (!await exists(coredir)) {
      return corefiles;
    }
    const files = await readdir(coredir);
    for (const file of files) {
      if (coreprefix.every(prefix => !file.startsWith(prefix) || file.endsWith('.gz'))) {
        continue;
      }

      // check core file stat
      const corefile = path.join(coredir, file);
      const filestat = await stat(corefile);

      if (!filestat.isFile()) {
        continue;
      }

      if (filestat.ctimeMs < Date.now() - REPORT_INTERVAL * 1000) {
        continue;
      }

      corefiles.push(corefile);
    }
  } catch (err) {
    logger.error(`findCoreFile failed: ${err}`);
  }

  return corefiles;
}

async function findCoreFiles() {
  const tasks = coredirs.map(coredir => findCoreFile(coredir));
  const nodeExe = await realpath(await getNodeExe(process.pid, false));
  const fileList = await Promise.all(tasks);

  // get corefiles
  let corefiles = fileList
    .reduce((list, files) => list.concat(files), [])
    .map(corefile => ({
      core_path: corefile,
      executable_path: nodeExe,
      node_version: process.versions.node,
      alinode_version: process.versions.alinode,
    }));
  if (corefiles.length > MAX_CORE_FILES) {
    corefiles = corefiles.slice(0, MAX_CORE_FILES);
  }

  return corefiles;
}

exports = module.exports = async function() {
  const message = { type: 'core_files', data: { list: [] } };

  // concat coredirs
  const pwds = await getNodePwds(this.titles);
  coredirs = Array.from(new Set(coredirs.concat(pwds)));

  logger.debug(`[report_core] coredirs: ${coredirs.join(', ')}`);

  // find core files
  message.data.list = await findCoreFiles();

  return message;
};

exports.init = async function() {
  logger = this.logger;

  // 1. from user config
  coredirs = this.coredirs.concat(coredirs);
  coreprefix = this.coreprefix.concat(coreprefix);

  // 2. from core_pattern
  if (!isLinux || !await exists(CORE_PATTERN)) {
    return;
  }
  let patt = await readFile(CORE_PATTERN, 'utf8');
  patt = patt.trim().split(' ')[0];
  if (patt.includes('%')) {
    const coredir = path.parse(patt).dir;
    if (await exists(coredir)) {
      try {
        await access(coredir, fs.R_OK);
        coredirs.push(coredir);
        const prefix = path.parse(patt).name.split('%')[0];
        if (!coreprefix.includes(prefix)) {
          coreprefix.push(prefix);
        }
      } catch (e) {
        logger.error(coredir + ' is unaccessible: ' + e.message);
      }
    }
  }
};

exports.interval = process.env.UNIT_TEST_TRANSIT_LOG_INTERVAL || REPORT_INTERVAL;
