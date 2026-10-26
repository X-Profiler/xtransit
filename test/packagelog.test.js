'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
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
    expect(pkg.lockType).to.be('package-lock');
  });
});

for (const version of [ '8', '9' ]) {
  describe(`get pnpm ${version} package info`, function() {
    const packageFile = path.join(__dirname, `./fixtures/pnpm${version}/package.json`);
    const context = Object.assign({}, baseContext, { packages: [ packageFile ] });

    before(async function() {
      await packagLib.init.call(context);
    });

    it('should send the pnpm lockfile and importer id', async function() {
      const pkg = (await packagLib.call(context)).data.pkgs[0];
      expect(pkg.name).to.be(packageFile);
      expect(pkg.lockType).to.be('pnpm');
      expect(pkg.lockImporter).to.be('.');
      expect(pkg.lock).to.contain(`lockfileVersion: '${version === '8' ? '6' : '9'}.0'`);
    });
  });
}

describe('get pnpm workspace package info', function() {
  const packageFile = path.join(__dirname, './fixtures/pnpm-workspace/apps/web/package.json');
  const context = Object.assign({}, baseContext, { packages: [ packageFile ] });

  before(async function() {
    await packagLib.init.call(context);
  });

  it('should report the importer relative to the workspace root', async function() {
    const pkg = (await packagLib.call(context)).data.pkgs[0];
    expect(pkg.lockType).to.be('pnpm');
    expect(pkg.lockImporter).to.be('apps/web');
  });
});

describe('get package info with multiple lockfiles', function() {
  let directory;
  let context;

  before(async function() {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'xtransit-pnpm-'));
    fs.writeFileSync(path.join(directory, 'package.json'), '{"name":"lockfile-test","version":"1.0.0"}');
    fs.writeFileSync(path.join(directory, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'");
    context = Object.assign({}, baseContext, { packages: [ path.join(directory, 'package.json') ] });
    await packagLib.init.call(context);
  });

  after(function() {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('should collect pnpm when it is the only lockfile', async function() {
    const pkg = (await packagLib.call(context)).data.pkgs[0];
    expect(pkg.lockType).to.be('pnpm');
  });

  it('should preserve package-lock precedence', async function() {
    fs.writeFileSync(path.join(directory, 'package-lock.json'), '{"lockfileVersion":1}');
    const pkg = (await packagLib.call(context)).data.pkgs[0];
    expect(pkg.lockType).to.be('package-lock');
    expect(pkg.lock).to.be('{"lockfileVersion":1}');
  });

  it('should not claim a lockfile when none exists', async function() {
    fs.unlinkSync(path.join(directory, 'package-lock.json'));
    fs.unlinkSync(path.join(directory, 'pnpm-lock.yaml'));
    const pkg = (await packagLib.call(context)).data.pkgs[0];
    expect(pkg.lockType).to.be(undefined);
    expect(pkg.lock).to.be(undefined);
  });
});
