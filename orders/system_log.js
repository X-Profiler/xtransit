/* istanbul ignore file */
'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const moment = require('moment');
const { isNumber } = require('../common/utils');
const getNodeExe = require('../common/exe');
const pkg = require('../package.json');
const { promisify } = require('util');
const exec = promisify(cp.exec);
const exists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

let logger;

// system
const isLinux = os.platform() === 'linux';
const isWindows = os.platform() === 'win32';
const isMacOS = os.platform() === 'darwin';
let cgroupBaseDir = '/sys/fs/cgroup';
let clkTck = 100;

// cpu
let lastTotal = 0;
let lastIdle = 0;
let last_used = 0;
let last_sys = 0;
let cpuNumber = 0;

// memory
let totalMemory = 0;

// docker
let isDocker = false;

async function initClkTck() {
  let clk_tck;
  try {
    const { stdout } = await exec('getconf CLK_TCK', { encoding: 'utf8' });
    clk_tck = stdout.trim();
  } catch (err) {
    return;
  }
  clkTck = Number(clk_tck) > 0 ? clk_tck : clkTck;
}

async function initDocker(docker) {
  if (docker === true || docker === false) {
    return (isDocker = docker);
  }

  if (!isLinux) {
    return (isDocker = false);
  }

  if (await exists('/.dockerenv')) {
    return (isDocker = true);
  }

  // .dockerenv not exists
  if (!await exists('/proc/self/cgroup')) {
    return (isDocker = false);
  }

  // check .dockerenv
  let raw = await readFile('/proc/self/cgroup', 'utf8');
  raw = raw.trim().split('\n');
  isDocker = raw.some(line => {
    if (line.includes('device') || line.includes('cpu')) {
      return line.split(':').some(item => item.startsWith('/docker/') || item.startsWith('/system.slice/docker'));
    }
    return false;
  });
}

async function initCpu() {
  cpuNumber = os.cpus().length;

  if (!isDocker) {
    return;
  }

  const period_path = path.join(cgroupBaseDir, '/cpu/cpu.cfs_period_us');
  const quota_path = path.join(cgroupBaseDir, '/cpu/cpu.cfs_quota_us');
  const cpus_path = path.join(cgroupBaseDir, '/cpuset/cpuset.cpus');
  let cpuset_cpus = 0;

  if (await exists(cpus_path)) {
    // 0-3,4,6-7
    // --cpuset-cpus="1-3,0", cpuset.cpus = 0-3
    // --cpuset-cpus="1-2,2-3", cpuset.cpus = 1-3
    // duplicated cpuset already handled by docker itself
    let cpus = await readFile(cpus_path, 'utf8');
    cpus = cpus.trim().split(',');
    for (let i = 0; i < cpus.length; i++) {
      if (cpus[i].includes('-')) {
        const c = cpus[i].split('-');
        cpuset_cpus += Number(c[1]) - Number(c[0]) + 1;
      } else if (isNumber(cpus[i])) {
        cpuset_cpus++;
      }
    }
  }

  if (cpuset_cpus > 0 && cpuset_cpus < cpuNumber) {
    cpuNumber = cpuset_cpus;
  }

  if (!await exists(period_path) || !await exists(quota_path)) {
    return;
  }

  const quota = parseInt((await readFile(quota_path, 'utf8')).trim(), 10);
  if (quota === -1) {
    return;
  }

  const period = parseInt((await readFile(period_path, 'utf8')).trim(), 10);
  if (period <= 0) {
    return;
  }

  if (quota / period < cpuNumber) {
    cpuNumber = quota / period;
  }
}

async function initTotalMemory() {
  totalMemory = os.totalmem();

  if (!isDocker) {
    return;
  }

  const mem_limit_path = path.join(cgroupBaseDir, '/memory/memory.limit_in_bytes');
  const mem_soft_limit_path = path.join(cgroupBaseDir, '/memory/memory.soft_limit_in_bytes');

  if (!await exists(mem_limit_path) || !await exists(mem_soft_limit_path)) {
    // keep os.totalmem() if limit or soft_limit not exists
    return;
  }

  const limit = Number((await readFile(mem_limit_path, 'utf8')).trim().split('\n'));
  const soft_limit = Number((await readFile(mem_soft_limit_path, 'utf8')).trim().split('\n'));
  if ((limit > Number.MAX_SAFE_INTEGER || !isNumber(limit)) &&
    (soft_limit > Number.MAX_SAFE_INTEGER || !isNumber(soft_limit))) {
    // if > MAX_SAFE_INTEGER no limit
    // if no limit or NaN, ignore it
    return;
  }

  if (limit > Number.MAX_SAFE_INTEGER || !isNumber(limit)) {
    totalMemory = soft_limit;
    return;
  }

  if (soft_limit > Number.MAX_SAFE_INTEGER || !isNumber(soft_limit)) {
    totalMemory = limit;
    return;
  }

  totalMemory = soft_limit < limit ? soft_limit : limit;
}

async function getCgroupBaseDir() {
  // \' \' is needed
  const command = 'mount|grep cgroup/memory|awk \'{print $3}\'';
  let cgroup_mem_dir = '';
  try {
    const { stdout } = await exec(command, { encoding: 'utf8', stdio: 'ignore' });
    cgroup_mem_dir = stdout.trim();
  } catch (err) {
    err;
    // err can be ignored, use the default /sys/fs/cgroup
  }
  if (cgroup_mem_dir && cgroup_mem_dir.startsWith('/') && cgroup_mem_dir.endsWith('memory')) {
    return path.parse(cgroup_mem_dir).dir;
  }
  return '/sys/fs/cgroup';
}

async function getUsedCpuFromProc(file) {
  // process exists when get processes, process exit when read stat
  try {
    const data = await readFile(file, 'utf8');
    if (data) {
      const pstat = data.trim().split(' ');
      const used = parseInt(pstat[13], 10) +
        parseInt(pstat[14], 10) +
        parseInt(pstat[15], 10) +
        parseInt(pstat[16], 10);
      return used;
    }
  } catch (err) {
    err;
    return 0;
  }
}

async function getAllUsedCpuFromProc() {
  try {
    const dir = '/proc';
    const files = await readdir(dir);
    if (files.length === 0) {
      return 0;
    }
    const processes = files
      .map(file => isNumber(file) && path.join(dir, file, 'stat'))
      .filter(file => file);

    const cntr = processes.length;
    const tasks = [];
    for (let i = 0; i < cntr; i++) {
      tasks.push(getUsedCpuFromProc(processes[i]));
    }
    const data = await Promise.all(tasks);
    return data.reduce((r, d) => {
      r += d;
      return r;
    }, 0);
  } catch (err) {
    err;
    return 0;
  }
}

async function dockerCpuUsage() {
  const used = await getAllUsedCpuFromProc();
  const sys = Date.now();
  const diff_used = (used - last_used) * (1000 / clkTck);
  const diff_sys = sys - last_sys;
  last_used = used;
  last_sys = sys;
  if (diff_sys === 0) {
    return 0;
  }
  return diff_used / diff_sys / cpuNumber;
}

async function linuxCpuUsage() {
  try {
    const data = await readFile('/proc/stat', 'utf8');
    const lines = data.trim().split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
      const match = lines[idx].match(/^cpu \s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (!match) {
        continue;
      }
      let total = 0;
      for (let j = 0; j < 8; j++) {
        total += parseInt(match[j + 1], 10);
      }
      const idle = parseInt(match[4], 10) +
        parseInt(match[5], 10) + parseInt(match[8], 10);

      const diffTotal = total - lastTotal;
      const diffIdle = idle - lastIdle;
      lastTotal = total;
      lastIdle = idle;
      if (diffTotal === 0) {
        return 0;
      }
      return 1 - diffIdle / diffTotal;
    }
    return 0;
  } catch (err) {
    err;
    return 0;
  }

}

function cpuUsage() {
  const cpus = os.cpus();
  let total = 0;
  let idle = 0;
  for (let i = 0; i < cpus.length; i++) {
    const time = cpus[i].times;
    total += time.user + time.nice + time.sys + time.idle;
    idle += time.idle;
  }

  const diffTotal = total - lastTotal;
  const diffIdle = idle - lastIdle;
  lastTotal = total;
  lastIdle = idle;

  return 1 - diffIdle / diffTotal;
}

async function getCpuUsage() {
  let usage;
  // check order is important, please don't check linux firstly
  if (isDocker) {
    usage = await dockerCpuUsage();
  } else if (isLinux) {
    usage = await linuxCpuUsage();
  } else {
    usage = cpuUsage();
  }

  return usage;
}

async function dockerFreeMemory() {
  const mem_used_path = path.join(cgroupBaseDir, '/memory/memory.usage_in_bytes');
  const mem_stat_path = path.join(cgroupBaseDir, '/memory/memory.stat');

  const mem_used = await readFile(mem_used_path, 'utf8');
  const mem_stat = await readFile(mem_stat_path, 'utf8');

  // convert memory.stat file content to object
  //  total_inactive_file 1122323
  //  total_active_file 12323
  // =>
  //  {total_inactive_file: 1122323, total_active_file: 12323  }
  const mem_stat_obj = mem_stat.trim().split('\n').map(v => v.split(' '))
    .reduce((r, v) => { r[v[0]] = v[1]; return r; }, {});

  const used_size = Number(mem_used.trim());
  const total_active_file_size = Number(mem_stat_obj.total_active_file.trim());
  const total_inactive_file_size = Number(mem_stat_obj.total_inactive_file.trim());

  return totalMemory - used_size + (total_active_file_size + total_inactive_file_size);
}

/*
  MemTotal:        7852888 kB
  MemFree:          635184 kB
  MemAvailable:    1877656 kB
  Buffers:          701844 kB
  Cached:          1307420 kB
  SwapCached:       232084 kB
*/
async function linuxFreeMemroy() {
  const isMemAvailable = os.release() >= '3.14';
  let free = 0;
  const data = await readFile('/proc/meminfo', 'utf8');
  const usage = data.trim().split('\n');
  usage.forEach(line => {
    const pair = line.split(':');
    if (isMemAvailable) {
      if (pair[0] === 'MemAvailable') {
        free = parseInt(pair[1], 10) * 1024;
      }
    } else {
      if (['MemFree', 'Buffers', 'Cached'].indexOf(pair[0]) >= 0) {
        free += parseInt(pair[1], 10) * 1024;
      }
    }
  });
  if (free) {
    return free;
  }
  return os.freemem();
}

/*
 Mach Virtual Memory Statistics: (page size of 4096 bytes)
 Pages free:                               17763.
 Pages active:                            766990.
 Pages inactive:                          760126.
 Pages speculative:                         6119.
 Pages throttled:                              0.
 Pages wired down:                       2202907.
*/
async function osxFreeMemory() {
  const mappings = {
    'Pages purgeable': 'purgeable',
    'Pages wired down': 'wired',
    'Pages active': 'active',
    'Pages inactive': 'inactive',
    'Pages occupied by compressor': 'compressed',
  };

  let [{ stdout: vmStat }, { stdout: pagePageable }] =
    await Promise.all([
      exec('vm_stat'),
      exec('sysctl vm.page_pageable_internal_count'),
    ]);
  vmStat = vmStat.toString().trim();
  pagePageable = pagePageable.toString().trim();

  // get page size
  let pageSize = 4096;
  const matchdPageSize = /page size of (\d+) bytes/.exec(vmStat);
  if (matchdPageSize && isNumber(matchdPageSize[1])) {
    pageSize = Number(matchdPageSize[1]);
  }

  // get page pageable
  let [, pageableValue] = pagePageable.split(':');
  if (!isNumber(pageableValue)) {
    return os.freemem();
  }
  pageableValue = Number(pageableValue) * pageSize;

  // get vm stats
  const lines = vmStat
    .split('\n')
    .filter(x => x !== '');

  const stats = {};
  lines.forEach(x => {
    const parts = x.split(':');
    const key = parts[0];
    const val = parts[1].replace('.', '').trim();

    if (mappings[key]) {
      const ky = mappings[key];
      stats[ky] = val * pageSize;
    }
  });

  // get app memory
  const appMemory = pageableValue - stats.purgeable;

  // get wired memory
  const wiredMemory = stats.wired;

  // get compressed memory
  const compressedMemory = stats.compressed;

  logger.debug(`[system_log] page_size: ${pageSize}, wired: ${wiredMemory}, app: ${appMemory}, compressed: ${compressedMemory}`);
  const used = appMemory + wiredMemory + compressedMemory;
  return totalMemory - used;
}

async function getFreeMemory() {
  let free;
  if (isDocker) {
    try {
      free = await dockerFreeMemory();
    } catch (err) {
      err;
      free = await linuxFreeMemroy();
    } finally {
      free = free || os.freemem();
    }
  } else if (isLinux) {
    free = await linuxFreeMemroy();
  } else if (isMacOS) {
    free = await osxFreeMemory();
  } else {
    free = os.freemem();
  }

  return free;
}

async function getLoadAvg() {
  if (!isLinux) {
    return os.loadavg();
  }

  const data = await readFile('/proc/loadavg', 'utf8');
  const load = data.trim();
  const reg = /(\d+.\d+)\s+(\d+.\d+)\s+(\d+.\d+)/;
  const loads = load.match(reg);
  if (loads) {
    return [Number(loads[1]), Number(loads[2]), Number(loads[3])];
  }
  return os.loadavg();
}

async function getDiskUsage(disks) {
  if (isWindows) {
    return {};
  }
  // '/dev/sda6         14674404 13161932    744012      95% /'
  // '/dev/sda3         80448976 67999076   8340248      90% /home/admin/'
  const existsDisks = [];
  for (const disk of disks) {
    if (!await exists(disk)) {
      continue;
    }
    existsDisks.push(disk);
  }
  const params = existsDisks.length ? ` ${existsDisks.join(' ')}` : '';
  const command = `df -P${params}`;

  logger.debug(`[system_log] get disks info: ${command}`);
  const { stdout } = await exec(command);
  const metric = {};
  const results = stdout.trim();
  const lines = results.split('\n');
  lines.forEach(line => {
    if (line.startsWith('/')) {
      const match = line.match(/(\d+)%\s+(\/.*$)/);
      if (match) {
        const rate = parseInt(match[1] || 0);
        const mounted = match[2];
        if (!mounted.startsWith('/Volumes/') && !mounted.startsWith('/private/')) {
          metric[mounted] = rate;
        }
      }
    }
  });

  if (Object.keys(metric).length === 0) {
    return {};
  }
  return metric;
}

async function getNodeCount(titles = [], commandPath) {
  const nodeExe = await getNodeExe(process.pid);
  const file = commandPath || path.join(__dirname, '../commands/get_node_processes.js');
  const cmd = `${nodeExe} ${JSON.stringify(file)}`;
  const { stdout } = await exec(cmd, {
    encoding: 'utf8',
    stdio: 'ignore',
    env: Object.assign({
      XTRANSIT_TITLES: JSON.stringify(titles),
    }, process.env),
  });
  return stdout
    .split('\n')
    .filter(proc => proc)
    .length;
}

exports = module.exports = async function() {
  const data = {
    cpu_count: cpuNumber,
    total_memory: totalMemory,
    uptime: os.uptime(),
    log_time: moment().format('YYYY-MM-DD HH:mm:ss'),
    log_timestamp: Date.now(),
    version: pkg.version,
  };
  const message = { type: 'system_log', data };

  const tasks = [];
  tasks.push(getCpuUsage());
  tasks.push(getFreeMemory());
  tasks.push(getLoadAvg());
  tasks.push(getDiskUsage(this.disks));
  tasks.push(getNodeCount(this.titles));

  const [
    used_cpu,
    free_memory,
    [load1, load5, load15],
    disks,
    node_count,
  ] = await Promise.all(tasks);
  data.used_cpu = used_cpu;
  data.free_memory = free_memory;
  data.load1 = load1;
  data.load5 = load5;
  data.load15 = load15;
  data.disks = disks;
  data.node_count = node_count;

  return message;
};

exports.init = async function() {
  logger = this.logger;

  // init clk tck
  await initClkTck();

  // init docker
  await initDocker(this.docker);
  if (isDocker) {
    cgroupBaseDir = await getCgroupBaseDir();
  }

  // init cpu
  await initCpu();

  // init memory
  await initTotalMemory();
};

exports.interval = 60;

exports.getNodeCount = getNodeCount;
