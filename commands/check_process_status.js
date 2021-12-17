'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const cp = require('child_process');
const exec = promisify(cp.exec);
const exists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
const { isNumber, checkAlive, sleep } = require('../common/utils');
const getNodeExe = require('../common/exe');
const getCwd = require('../common/cwd');

const pid = process.argv[2];
if (!isNumber(pid) || !checkAlive(pid)) {
  console.error(`process ${pid} not exists!`);
  return;
}

const status = {
  pid,
  nodeVersion: process.versions.node,
  installXprofiler: false,
  enableXprofiler: false,
  xtransitLogdir: process.env.XTRANSIT_LOGDIR,
};

async function execute(cmd, opts = {}) {
  try {
    const options = Object.assign({ timeout: 1000, env: process.env }, opts);
    const { stdout } = await exec(cmd, options);
    return stdout && stdout.toString().trim();
  } catch (err) {
    err;
    return false;
  }
}

async function checkInstalled(nodeExe, cwd) {
  const result = await execute(`${nodeExe} -p 'require.resolve("xprofiler")'`, { cwd, stdio: 'ignore' });
  status.installXprofiler = result !== false;
}

async function checkStatus() {
  const nodeExe = await getNodeExe(pid);
  status.nodeVersion = await execute(`${nodeExe} -v`);
  status.alinodeVersion = await execute(`${nodeExe} -V`);

  const processCwd = await getCwd(pid);
  await checkInstalled(nodeExe, processCwd);

  const hiddenFile = path.join(os.homedir(), '.xprofiler');
  if (await exists(hiddenFile)) {
    const content = (await readFile(hiddenFile, { encoding: 'utf8' })).trim();
    for (const proc of content.split('\n')) {
      const [xpid, logdir, cwd, , , mod] = proc.split('\u0000');
      if (Number(pid) === Number(xpid)) {
        // check mod installed
        if (!status.installXprofiler) {
          await checkInstalled(nodeExe, cwd);
        }

        // find xctl
        const xctl = path.join(mod, 'lib/xctl.js');
        if (!await exists(xctl)) {
          break;
        }

        // get xprofiler logdir
        status.xprofilerLogdir = path.resolve(logdir);

        // get version
        const { ok: ok1, data: data1 } = await require(xctl)(pid, 'check_version');
        if (ok1) {
          const { version } = data1;
          status.installXprofiler = true;
          status.enableXprofiler = true;
          status.xprofilerVersion = `v${version}`;
        }

        // sleep for releasing named pipe
        if (os.platform() === 'win32') {
          await sleep(200);
        }

        // get xprofiler config
        const { ok: ok2, data: data2 } = await require(xctl)(pid, 'get_config');
        if (ok2) {
          status.xprofilerConfig = data2;
        }
      }
    }
  }

  console.log(JSON.stringify(status));
}

checkStatus().catch(err => console.error(err.message));
