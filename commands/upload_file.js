'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const qs = require('querystring');
const FormData = require('form-data');
const urllib = require('urllib');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const utils = require('../common/utils');

const [fileId, fileType, filePath, server, token] = process.argv.slice(2);
const agentId = process.env.XTRANSIT_AGENT_ID;
const cleanAfterUpload = process.env.XTRANSIT_CLEAN_AFTER_UPLOAD;

console.warn = function() { };

async function gzipFile(filePath) {
  const gzippedFile = path.join(path.dirname(filePath), `${path.basename(filePath)}.gz`);
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

function request(url, opts) {
  return new Promise((resolve, reject) => {
    urllib.request(url, opts, function(err, data, res) {
      if (err) {
        return reject(err);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`response failed with status code: ${res.statusCode}, data: ${JSON.stringify(data)}`));
      }
      if (!data.ok) {
        return reject(new Error(`transfer falied: ${data.message}`));
      }
      resolve(data.data);
    });
  });
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
    stream: formdata,
  };

  const result = await request(url, opts);
  if (result.storage && cleanAfterUpload === 'YES') {
    await removeExists(removeFiles);
    result.removeFiles = removeFiles;
  }
  console.log(JSON.stringify(result));
}

uploadFile().catch(err => console.error(err.message));
