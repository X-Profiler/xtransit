'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const qs = require('node:querystring');
const FormData = require('form-data');
const urllib = require('urllib');
const { promisify } = require('node:util');
const crypto = require('node:crypto');
const exists = promisify(fs.exists);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const utils = require('../common/utils');

const [fileId, fileType, filePath, server, token] = process.argv.slice(2);
const agentId = process.env.XTRANSIT_AGENT_ID;
const cleanAfterUpload = process.env.XTRANSIT_CLEAN_AFTER_UPLOAD;

console.warn = function() { };

async function gzipFile(filePath) {
  // 避免文件同名，对原路径取 md5 哈希作为新文件名
  const pathHash = crypto.createHash('md5').update(filePath).digest('hex');
  const gzippedFile = path.join(utils.getXtransitPrefix(), `${path.basename(filePath)}-${pathHash}.gz`);
  if (await exists(gzippedFile)) {
    return gzippedFile;
  }
  const gzip = zlib.createGzip();
  const gzipFileStream = fs.createWriteStream(gzippedFile);
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(gzip)
      .on('error', err => reject(new Error(`gzip file ${filePath} failed: ${err.message}`)))
      .pipe(gzipFileStream)
      .on('error', err => reject(new Error(`gzip pipe file ${filePath} failed: ${err.message}`)))
      .on('finish', () => resolve(gzippedFile));
  });
}

async function request(url, opts) {
  const result = await urllib.request(url, opts);
  const data = result.data;
  if (result.statusCode !== 200) {
    throw new Error(`response failed with status code: ${result.statusCode}, data: ${JSON.stringify(data)}`);
  }
  if (!data.ok) {
    throw new Error(`transfer failed: ${data.message}`);
  }
  return data.data;
}

async function removeExists(files) {
  try {
    await Promise.all(files.map(file => unlink(file)));
  } catch (err) {
    err;
  }
}

async function checkFile(filePath) {
  if (!await exists(filePath)) {
    throw new Error(`file ${filePath} not exists`);
  }

  if (!(await stat(filePath)).size) {
    throw new Error(`file ${filePath} is empty`);
  }
}

async function uploadFile() {
  if (!utils.isNumber(fileId) || !fileType || !filePath || !server || !token) {
    throw new Error('wrong args: node upload_file.js fileId fileType filePath server token');
  }

  let files = [];
  if (fileType === 'core') {
    // core_path::node_executable_path
    files = filePath.split('::');
  } else {
    files = [filePath];
  }

  const removeFiles = [files[0]];

  // create form
  const formdata = new FormData();
  for (const filePath of files) {
    await checkFile(filePath);
    const gzippedFile = await gzipFile(filePath);
    formdata.append(path.basename(filePath), fs.createReadStream(gzippedFile));

    removeFiles.push(gzippedFile);
  }

  // create url
  const nonce = '' + (1 + parseInt((Math.random() * 100000000000), 10));
  const timestamp = String(Date.now());
  const signature = utils.sign({ agentId, fileId, fileType, nonce, timestamp }, token);
  const url = `${server}/xapi/upload_from_xtransit?${qs.stringify({ fileId, fileType, nonce, timestamp, signature })}`;

  const opts = {
    dataType: 'json',
    type: 'POST',
    timeout: process.env.XTRANSIT_EXPIRED_TIME || 20 * 60 * 1000,
    headers: formdata.getHeaders(),
    content: formdata,
  };

  const result = await request(url, opts);
  if (result.storage && cleanAfterUpload === 'YES') {
    await removeExists(removeFiles);
    result.removeFiles = removeFiles;
  }
  console.log(JSON.stringify(result));
}

uploadFile().catch(err => console.error(err.message));
