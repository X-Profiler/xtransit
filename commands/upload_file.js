'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const qs = require('querystring');
const formstream = require('formstream');
const urllib = require('urllib');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const stat = promisify(fs.stat);
const gzip = zlib.createGzip();
const utils = require('../common/utils');

const [fileId, fileType, filePath, server, token] = process.argv.slice(2);
const agentId = process.env.XTRANSIT_AGENT_ID;

console.warn = function() { };

async function gzipFile(filePath) {
  const gzippedFile = path.join(path.dirname(filePath), `${path.basename(filePath)}.gz`);
  if (await exists(gzippedFile)) {
    return gzippedFile;
  }
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

async function uploadFile() {
  if (!utils.isNumber(fileId) || !fileType || !filePath || !server || !token) {
    throw new Error('wrong args: node upload_file.js fileId fileType filePath server token');
  }

  if (!await exists(filePath)) {
    throw new Error(`file ${filePath} not exists`);
  }

  if (!(await stat(filePath)).size) {
    throw new Error(`file ${filePath} is empty`);
  }

  // create form
  const gzippedFile = await gzipFile(filePath);
  const form = formstream();
  const size = (await stat(gzippedFile)).size;
  form.file('file', gzippedFile, gzippedFile, size);

  // create url
  const nonce = '' + (1 + parseInt((Math.random() * 100000000000), 10));
  const timestamp = String(Date.now());
  const signature = utils.sign({ agentId, fileId, fileType, nonce, timestamp }, token);
  const url = `${server}/xapi/upload_from_xtransit?${qs.stringify({ fileId, fileType, nonce, timestamp, signature })}`;

  const opts = {
    dataType: 'json',
    type: 'POST',
    timeout: process.env.XTRANSIT_EXPIRED_TIME || 20 * 60 * 1000,
    headers: form.headers(),
    stream: form,
  };

  const result = await request(url, opts);
  console.log(JSON.stringify(result));
}

uploadFile().catch(err => console.error(err.message));
