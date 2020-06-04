'use strict';

const fs = require('fs');
const { promisify } = require('util');
const exists = promisify(fs.exists);

const filePath = process.argv[2];

async function checkFileStatus() {
  const result = {};
  result.exists = filePath && await exists(filePath);
  console.log(JSON.stringify(result));
}

checkFileStatus().catch(err => console.error(err.message));
