'use strict';

const path = require('path');
const expect = require('expect.js');
const packagLib = require('../orders/package');
const baseContext = require('./fixtures/context');
const { setErrorText } = baseContext;

describe('get package info', function() {
  const packages = [];
  const context = Object.assign({}, baseContext, { packages });

  before(async function() {
    await packagLib.init.call(context);
  });

  after(async function() {
    setErrorText('');
  });

  it('should get empty packages with config { packages: [] }', async function() {
    const message = await packagLib.call(context);
    expect(message.type).to.be('package');
    expect(message.data.pkgs.length).to.be(0);
  });
});

describe('get package info', function() {
  const packages = [
    path.join(__dirname, './fixtures/files/package1.json'),
  ];
  const context = Object.assign({}, baseContext, { packages });

  before(async function() {
    await packagLib.init.call(context);
  });

  after(async function() {
    setErrorText('');
  });

  it('should get empty package content when package file not exisis', async function() {
    const message = await packagLib.call(context);
    expect(message.type).to.be('package');
    expect(message.data.pkgs.length).to.be(1);
    expect(Object.keys(message.data.pkgs[0]).length).to.be(0);
  });
});

describe('get package info', function() {
  const packageFile = path.join(__dirname, './fixtures/files/package.json');
  const packages = [packageFile];
  const context = Object.assign({}, baseContext, { packages });

  before(async function() {
    await packagLib.init.call(context);
  });

  after(async function() {
    setErrorText('');
  });

  it('should get empty package content when package exisis', async function() {
    const message = await packagLib.call(context);
    expect(message.type).to.be('package');
    expect(message.data.pkgs.length).to.be(1);
    const pkg = message.data.pkgs[0];
    expect(pkg.name).to.be(packageFile);
    expect(pkg.pkg).to.be.ok();
    expect(pkg.lock).to.be.ok();
  });
});
