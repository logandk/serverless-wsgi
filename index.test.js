'use strict';

const chai = require("chai");
const expect = chai.expect;
const sinon = require('sinon');
const Plugin = require('./index');
const child_process = require('child_process');
const path = require('path');
const fse = require('fs-extra');

const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

describe('serverless-wsgi', function() {
  describe('init', function() {
    it('registers commands', function() {
      var plugin = new Plugin();

      expect(plugin.commands.wsgi.commands.serve.lifecycleEvents).to.include('serve');
    });

    it('registers hooks', function() {
      var plugin = new Plugin();

      expect(plugin.hooks['before:deploy:createDeploymentArtifacts']).to.be.a('function');
      expect(plugin.hooks['after:deploy:createDeploymentArtifacts']).to.be.a('function');
      expect(plugin.hooks['wsgi:serve:serve']).to.be.a('function');
    });
  });

  describe('wsgi', function() {
    it('skips packaging for non-wsgi app', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {},
        classes: { Error: Error },
        cli: { log: function () {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copy_stub = sandbox.stub(fse, 'copyAsync');
      var write_stub = sandbox.stub(fse, 'writeFileAsync');
      var proc_stub = sandbox.stub(child_process, 'spawnSync');
      plugin.hooks['before:deploy:createDeploymentArtifacts']().then(function () {
        expect(copy_stub.called).to.be.false;
        expect(write_stub.called).to.be.false;
        expect(proc_stub.called).to.be.false;
        sandbox.restore();
      });
    });

    it('packages wsgi handler', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error },
        cli: { log: function () {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copy_stub = sandbox.stub(fse, 'copyAsync');
      var write_stub = sandbox.stub(fse, 'writeFileAsync');
      var proc_stub = sandbox.stub(child_process, 'spawnSync', function () {
        return { status: 0 };
      });
      plugin.hooks['before:deploy:createDeploymentArtifacts']().then(function () {
        expect(copy_stub.calledWith(
          path.resolve(__dirname, 'wsgi.py'),
          '/tmp/wsgi.py'
        )).to.be.ok;
        expect(write_stub.calledWith(
          '/tmp/.wsgi_app', 'api.app'
        )).to.be.ok;
        expect(proc_stub.calledWith(
          'python',
          [
            path.resolve(__dirname, 'requirements.py'),
            path.resolve(__dirname, 'requirements.txt'),
            '/tmp/.requirements'
          ]
        )).to.be.ok;
        sandbox.restore();
      });
    });

    it('cleans up after deployment', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error },
        cli: { log: function () {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var remove_stub = sandbox.stub(fse, 'removeAsync');
      plugin.hooks['after:deploy:createDeploymentArtifacts']().then(function () {
        expect(remove_stub.calledWith('/tmp/wsgi.py')).to.be.ok;
        expect(remove_stub.calledWith('/tmp/.wsgi_app')).to.be.ok;
        expect(remove_stub.calledWith('/tmp/.requirements')).to.be.ok;
        sandbox.restore();
      });
    });
  });

  describe('requirements', function() {
    it('packages user requirements for wsgi app', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error },
        cli: { log: function () {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copy_stub = sandbox.stub(fse, 'copyAsync');
      var write_stub = sandbox.stub(fse, 'writeFileAsync');
      var exists_stub = sandbox.stub(fse, 'existsSync', function () { return true; });
      var proc_stub = sandbox.stub(child_process, 'spawnSync', function () {
        return { status: 0 };
      });
      plugin.hooks['before:deploy:createDeploymentArtifacts']().then(function () {
        expect(copy_stub.called).to.be.true;
        expect(write_stub.called).to.be.true;
        expect(proc_stub.calledWith(
          'python',
          [
            path.resolve(__dirname, 'requirements.py'),
            path.resolve(__dirname, 'requirements.txt'),
            '/tmp/requirements.txt',
            '/tmp/.requirements'
          ]
        )).to.be.ok;
        sandbox.restore();
      });
    });

    it('packages user requirements for wsgi app inside directory', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          custom: { wsgi: { app: 'api/api.app' } }
        },
        classes: { Error: Error },
        cli: { log: function () {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copy_stub = sandbox.stub(fse, 'copyAsync');
      var write_stub = sandbox.stub(fse, 'writeFileAsync');
      var exists_stub = sandbox.stub(fse, 'existsSync', function () { return true; });
      var proc_stub = sandbox.stub(child_process, 'spawnSync', function () {
        return { status: 0 };
      });
      plugin.hooks['before:deploy:createDeploymentArtifacts']().then(function () {
        expect(copy_stub.called).to.be.true;
        expect(write_stub.called).to.be.true;
        expect(proc_stub.calledWith(
          'python',
          [
            path.resolve(__dirname, 'requirements.py'),
            path.resolve(__dirname, 'requirements.txt'),
            '/tmp/api/requirements.txt',
            '/tmp/.requirements'
          ]
        )).to.be.ok;
        sandbox.restore();
      });
    });

    it('packages user requirements for non-wsgi app', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {},
        classes: { Error: Error },
        cli: { log: function () {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copy_stub = sandbox.stub(fse, 'copyAsync');
      var write_stub = sandbox.stub(fse, 'writeFileAsync');
      var exists_stub = sandbox.stub(fse, 'existsSync', function () { return true; });
      var proc_stub = sandbox.stub(child_process, 'spawnSync', function () {
        return { status: 0 };
      });
      plugin.hooks['before:deploy:createDeploymentArtifacts']().then(function () {
        expect(copy_stub.called).to.be.false;
        expect(write_stub.called).to.be.false;
        expect(proc_stub.calledWith(
          'python',
          [
            path.resolve(__dirname, 'requirements.py'),
            '/tmp/requirements.txt',
            '/tmp/.requirements'
          ]
        )).to.be.ok;
        sandbox.restore();
      });
    });

    it('skips packaging for non-wsgi app without user requirements', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {},
        classes: { Error: Error },
        cli: { log: function () {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copy_stub = sandbox.stub(fse, 'copyAsync');
      var write_stub = sandbox.stub(fse, 'writeFileAsync');
      var exists_stub = sandbox.stub(fse, 'existsSync', function () { return false; });
      var proc_stub = sandbox.stub(child_process, 'spawnSync', function () {
        return { status: 0 };
      });
      plugin.hooks['before:deploy:createDeploymentArtifacts']().then(function () {
        expect(copy_stub.called).to.be.false;
        expect(write_stub.called).to.be.false;
        expect(proc_stub.called).to.be.false;
        sandbox.restore();
      });
    });

    it('rejects with non successful exit code', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {},
        classes: { Error: Error },
        cli: { log: function () {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var exists_stub = sandbox.stub(fse, 'existsSync', function () { return true; });
      var proc_stub = sandbox.stub(child_process, 'spawnSync', function () {
        return { status: 1 };
      });

      expect(plugin.hooks['before:deploy:createDeploymentArtifacts']()).to.eventually.be.rejected.and.notify(function () {
        sandbox.restore();
      });
    });

    it('rejects with stderr output', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {},
        classes: { Error: Error },
        cli: { log: function () {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var exists_stub = sandbox.stub(fse, 'existsSync', function () { return true; });
      var proc_stub = sandbox.stub(child_process, 'spawnSync', function () {
        return { status: 0, error: 'fail' };
      });

      expect(plugin.hooks['before:deploy:createDeploymentArtifacts']()).to.eventually.be.rejected.and.notify(function () {
        sandbox.restore();
      });
    });

    it('skips packaging if chosen', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          custom: { wsgi: { app: 'api.app', packRequirements: false } }
        },
        classes: { Error: Error },
        cli: { log: function () {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copy_stub = sandbox.stub(fse, 'copyAsync');
      var write_stub = sandbox.stub(fse, 'writeFileAsync');
      var exists_stub = sandbox.stub(fse, 'existsSync', function () { return true; });
      var proc_stub = sandbox.stub(child_process, 'spawnSync', function () {
        return { status: 0 };
      });
      plugin.hooks['before:deploy:createDeploymentArtifacts']().then(function () {
        expect(copy_stub.called).to.be.true;
        expect(write_stub.called).to.be.true;
        expect(exists_stub.called).to.be.false;
        expect(proc_stub.called).to.be.false;
        sandbox.restore();
      });
    });
  });

  describe('serve', function() {
    it('fails for non-wsgi app', function() {
      var error = sinon.spy();

      var plugin = new Plugin({
        service: { provider: {} },
        classes: { Error: Error }
      });

      return expect(plugin.hooks['wsgi:serve:serve']()).to.be.rejected;
    });

    it('executes python wrapper', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: {},
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error }
      }, {});

      var stub = sinon.stub(child_process, 'spawnSync');
      plugin.hooks['wsgi:serve:serve']().then(function () {
        expect(stub.calledWith(
          'python',
          [
            path.resolve(__dirname, 'serve.py'),
            '/tmp',
            'api.app',
            5000
          ],
          { stdio: 'inherit' }
        )).to.be.ok;
        stub.restore();
      });
    });

    it('allows changing port', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: {},
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error }
      }, { port: 8000 });

      var stub = sinon.stub(child_process, 'spawnSync');
      plugin.hooks['wsgi:serve:serve']().then(function () {
        expect(stub.calledWith(
          'python',
          [
            path.resolve(__dirname, 'serve.py'),
            '/tmp',
            'api.app',
            8000
          ],
          { stdio: 'inherit' }
        )).to.be.ok;
        stub.restore();
      });
    });

    it('loads environment variables', function() {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: {
            environment: { SOME_ENV_VAR: 42 }
          },
          functions: [
            { handler: 'wsgi.handler', environment: { SECOND_VAR: 33 } },
            { handler: 'x.x', environment: { THIRD_VAR: 66 } },
            { handler: 'wsgi.handler' }
          ],
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error }
      }, { port: 8000 });

      var sandbox = sinon.sandbox.create();
      sandbox.stub(child_process, 'spawnSync');
      sandbox.stub(process, 'env', {});
      plugin.hooks['wsgi:serve:serve']().then(function () {
        expect(process.env.SOME_ENV_VAR).to.equal(42);
        expect(process.env.SECOND_VAR).to.equal(33);
        expect(process.env.THIRD_VAR).to.be.undefined;
        sandbox.restore();
      });
    });
  });
});
