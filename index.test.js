'use strict';

/* global describe it */
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const Plugin = require('./index');
const child_process = require('child_process');
const path = require('path');
const fse = require('fs-extra');

const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

describe('serverless-wsgi', () => {
  describe('init', () => {
    it('registers commands', () => {
      var plugin = new Plugin();

      expect(plugin.commands.wsgi.commands.serve.lifecycleEvents).to.include('serve');
    });

    it('registers hooks', () => {
      var plugin = new Plugin();

      expect(plugin.hooks['before:package:createDeploymentArtifacts']).to.be.a('function');
      expect(plugin.hooks['after:package:createDeploymentArtifacts']).to.be.a('function');
      expect(plugin.hooks['wsgi:serve:serve']).to.be.a('function');
      expect(plugin.hooks['before:offline:start:init']).to.be.a('function');
      expect(plugin.hooks['after:offline:start:end']).to.be.a('function');
    });
  });

  describe('wsgi', () => {
    it('skips packaging for non-wsgi app', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: { provider: { runtime: 'python2.7' } },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copyStub = sandbox.stub(fse, 'copyAsync');
      var writeStub = sandbox.stub(fse, 'writeFileAsync');
      var procStub = sandbox.stub(child_process, 'spawnSync');
      plugin.hooks['before:package:createDeploymentArtifacts']().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(procStub.called).to.be.false;
        sandbox.restore();
      });
    });

    it('packages wsgi handler', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copyStub = sandbox.stub(fse, 'copyAsync');
      var writeStub = sandbox.stub(fse, 'writeFileAsync');
      var procStub = sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      plugin.hooks['before:package:createDeploymentArtifacts']().then(() => {
        expect(copyStub.calledWith(
          path.resolve(__dirname, 'wsgi.py'),
          '/tmp/wsgi.py'
        )).to.be.true;
        expect(writeStub.calledWith(
          '/tmp/.wsgi_app', 'api.app'
        )).to.be.true;
        expect(procStub.calledWith(
          'python2.7',
          [
            path.resolve(__dirname, 'requirements.py'),
            path.resolve(__dirname, 'requirements.txt'),
            '/tmp/.requirements'
          ]
        )).to.be.true;
        sandbox.restore();
        expect(plugin.serverless.service.package.include).to.have.members(['wsgi.py', '.wsgi_app']);
        expect(plugin.serverless.service.package.exclude).to.have.members(['.requirements/**']);
      });
    });

    it('cleans up after deployment', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var removeStub = sandbox.stub(fse, 'removeAsync');
      plugin.hooks['after:package:createDeploymentArtifacts']().then(() => {
        expect(removeStub.calledWith('/tmp/wsgi.py')).to.be.true;
        expect(removeStub.calledWith('/tmp/.wsgi_app')).to.be.true;
        expect(removeStub.calledWith('/tmp/.requirements')).to.be.false;
        sandbox.restore();
      });
    });
  });

  describe('requirements', () => {
    it('packages user requirements for wsgi app', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } },
          package: { include: ['sample.txt'] }
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copyStub = sandbox.stub(fse, 'copyAsync');
      var writeStub = sandbox.stub(fse, 'writeFileAsync');
      var symlinkStub = sandbox.stub(fse, 'symlinkSync');
      sandbox.stub(fse, 'readdirSync').returns(['flask']);
      sandbox.stub(fse, 'existsSync').returns(true);
      var procStub = sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      plugin.hooks['before:package:createDeploymentArtifacts']().then(() => {
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(symlinkStub.called).to.be.true;
        expect(procStub.calledWith(
          'python2.7',
          [
            path.resolve(__dirname, 'requirements.py'),
            path.resolve(__dirname, 'requirements.txt'),
            '/tmp/requirements.txt',
            '/tmp/.requirements'
          ]
        )).to.be.true;
        expect(plugin.serverless.service.package.include).to.have.members(['sample.txt', 'wsgi.py', '.wsgi_app', 'flask', 'flask/**']);
        expect(plugin.serverless.service.package.exclude).to.have.members(['.requirements/**']);
        sandbox.restore();
      });
    });

    it('allows setting the python binary', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app', pythonBin: 'my-python' } },
          package: { include: ['sample.txt'] }
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copyStub = sandbox.stub(fse, 'copyAsync');
      var writeStub = sandbox.stub(fse, 'writeFileAsync');
      var symlinkStub = sandbox.stub(fse, 'symlinkSync');
      sandbox.stub(fse, 'readdirSync').returns(['flask']);
      sandbox.stub(fse, 'existsSync').returns(true);
      var procStub = sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      plugin.hooks['before:package:createDeploymentArtifacts']().then(() => {
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(symlinkStub.called).to.be.true;
        expect(procStub.calledWith(
          'my-python',
          [
            path.resolve(__dirname, 'requirements.py'),
            path.resolve(__dirname, 'requirements.txt'),
            '/tmp/requirements.txt',
            '/tmp/.requirements'
          ]
        )).to.be.true;
        expect(plugin.serverless.service.package.include).to.have.members(['sample.txt', 'wsgi.py', '.wsgi_app', 'flask', 'flask/**']);
        expect(plugin.serverless.service.package.exclude).to.have.members(['.requirements/**']);
        sandbox.restore();
      });
    });

    it('packages user requirements for wsgi app inside directory', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api/api.app' } }
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copyStub = sandbox.stub(fse, 'copyAsync');
      var writeStub = sandbox.stub(fse, 'writeFileAsync');
      sandbox.stub(fse, 'readdirSync').returns([]);
      sandbox.stub(fse, 'existsSync').returns(true);
      var procStub = sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      plugin.hooks['before:package:createDeploymentArtifacts']().then(() => {
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(procStub.calledWith(
          'python2.7',
          [
            path.resolve(__dirname, 'requirements.py'),
            path.resolve(__dirname, 'requirements.txt'),
            '/tmp/api/requirements.txt',
            '/tmp/api/.requirements'
          ]
        )).to.be.true;
        sandbox.restore();
      });
    });

    it('throws an error when a file already exists in the service root', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: { provider: { runtime: 'python2.7' } },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      sandbox.stub(fse, 'copyAsync');
      sandbox.stub(fse, 'writeFileAsync');
      sandbox.stub(fse, 'symlinkSync').throws();
      sandbox.stub(fse, 'readlinkSync').throws();
      sandbox.stub(fse, 'readdirSync').returns(['flask']);
      sandbox.stub(fse, 'existsSync').returns(true);
      sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      expect(plugin.hooks['before:package:createDeploymentArtifacts']()).to.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it('throws an error when a conflicting symlink already exists in the service root', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: { provider: { runtime: 'python2.7' } },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      sandbox.stub(fse, 'copyAsync');
      sandbox.stub(fse, 'writeFileAsync');
      sandbox.stub(fse, 'symlinkSync').throws();
      sandbox.stub(fse, 'readlinkSync').returns('not-flask');
      sandbox.stub(fse, 'readdirSync').returns(['flask']);
      sandbox.stub(fse, 'existsSync').returns(true);
      sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      expect(plugin.hooks['before:package:createDeploymentArtifacts']()).to.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it('packages user requirements for non-wsgi app', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: { provider: { runtime: 'python2.7' } },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copyStub = sandbox.stub(fse, 'copyAsync');
      var writeStub = sandbox.stub(fse, 'writeFileAsync');
      sandbox.stub(fse, 'symlinkSync').throws();
      sandbox.stub(fse, 'readlinkSync').returns('/tmp/.requirements/flask');
      sandbox.stub(fse, 'readdirSync').returns(['flask']);
      sandbox.stub(fse, 'existsSync').returns(true);
      var procStub = sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      plugin.hooks['before:package:createDeploymentArtifacts']().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(procStub.calledWith(
          'python2.7',
          [
            path.resolve(__dirname, 'requirements.py'),
            '/tmp/requirements.txt',
            '/tmp/.requirements'
          ]
        )).to.be.true;
        sandbox.restore();
      });
    });

    it('skips packaging for non-wsgi app without user requirements', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: { provider: { runtime: 'python2.7' } },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copyStub = sandbox.stub(fse, 'copyAsync');
      var writeStub = sandbox.stub(fse, 'writeFileAsync');
      sandbox.stub(fse, 'existsSync').returns(false);
      var procStub = sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      plugin.hooks['before:package:createDeploymentArtifacts']().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(procStub.called).to.be.false;
        expect(plugin.serverless.service.package.exclude).to.have.members(['.requirements/**']);
        sandbox.restore();
      });
    });

    it('rejects with non successful exit code', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: { provider: { runtime: 'python2.7' } },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      sandbox.stub(fse, 'existsSync').returns(true);
      sandbox.stub(child_process, 'spawnSync').returns({ status: 1 });

      expect(plugin.hooks['before:package:createDeploymentArtifacts']()).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it('rejects with stderr output', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: { provider: { runtime: 'python2.7' } },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      sandbox.stub(fse, 'existsSync').returns(true);
      sandbox.stub(child_process, 'spawnSync').returns({ status: 0, error: 'fail' });

      expect(plugin.hooks['before:package:createDeploymentArtifacts']()).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it('skips packaging if disabled', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app', packRequirements: false } }
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var copyStub = sandbox.stub(fse, 'copyAsync');
      var writeStub = sandbox.stub(fse, 'writeFileAsync');
      var existsStub = sandbox.stub(fse, 'existsSync').returns(true);
      var procStub = sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      plugin.hooks['before:package:createDeploymentArtifacts']().then(() => {
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(existsStub.called).to.be.false;
        expect(procStub.called).to.be.false;
        expect(plugin.serverless.service.package.include).not.to.have.members(['.requirements/**']);
        sandbox.restore();
      });
    });

    it('skips requirements cleanup if disabled', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app', packRequirements: false } }
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, {});

      var sandbox = sinon.sandbox.create();
      var removeStub = sandbox.stub(fse, 'removeAsync');
      plugin.hooks['after:package:createDeploymentArtifacts']().then(() => {
        expect(removeStub.calledWith('/tmp/wsgi.py')).to.be.true;
        expect(removeStub.calledWith('/tmp/.wsgi_app')).to.be.true;
        expect(removeStub.calledWith('/tmp/.requirements')).to.be.false;
        sandbox.restore();
      });

    });
  });

  describe('function deployment', () => {
    it('skips packaging for non-wsgi function', () => {
      var functions = {
        app: {}
      };
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } },
          functions: functions
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, { functionObj: functions.app });

      var sandbox = sinon.sandbox.create();
      var copyStub = sandbox.stub(fse, 'copyAsync');
      var writeStub = sandbox.stub(fse, 'writeFileAsync');
      var procStub = sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      plugin.hooks['before:deploy:function:packageFunction']().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(procStub.called).to.be.true;
        sandbox.restore();
      });
    });

    it('packages wsgi handler', () => {
      var functions = {
        app: { handler: 'wsgi.handler' }
      };
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } },
          functions: functions
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, { functionObj: functions.app });

      var sandbox = sinon.sandbox.create();
      var copyStub = sandbox.stub(fse, 'copyAsync');
      var writeStub = sandbox.stub(fse, 'writeFileAsync');
      sandbox.stub(fse, 'readdirSync').returns([]);
      sandbox.stub(fse, 'existsSync').returns(true);
      var procStub = sandbox.stub(child_process, 'spawnSync').returns({ status: 0 });
      plugin.hooks['before:deploy:function:packageFunction']().then(() => {
        expect(copyStub.calledWith(
          path.resolve(__dirname, 'wsgi.py'),
          '/tmp/wsgi.py'
        )).to.be.true;
        expect(writeStub.calledWith(
          '/tmp/.wsgi_app', 'api.app'
        )).to.be.true;
        expect(procStub.calledWith(
          'python2.7',
          [
            path.resolve(__dirname, 'requirements.py'),
            path.resolve(__dirname, 'requirements.txt'),
            '/tmp/requirements.txt',
            '/tmp/.requirements'
          ]
        )).to.be.true;
        sandbox.restore();
      });
    });

    it('cleans up after deployment', () => {
      var functions = {
        app: { handler: 'wsgi.handler' }
      };
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } },
          functions: functions
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, { functionObj: functions.app });

      var sandbox = sinon.sandbox.create();
      var removeStub = sandbox.stub(fse, 'removeAsync');
      var existsStub = sandbox.stub(fse, 'existsSync').returns(true);
      sandbox.stub(fse, 'readdirSync').returns(['flask']);
      var unlinkStub = sandbox.stub(fse, 'unlinkSync');
      plugin.hooks['after:deploy:function:packageFunction']().then(() => {
        expect(existsStub.calledWith('/tmp/.requirements')).to.be.true;
        expect(unlinkStub.calledWith('flask')).to.be.true;
        expect(removeStub.calledWith('/tmp/wsgi.py')).to.be.true;
        expect(removeStub.calledWith('/tmp/.wsgi_app')).to.be.true;
        expect(removeStub.calledWith('/tmp/.requirements')).to.be.false;
        sandbox.restore();
      });
    });
  });

  describe('serve', () => {
    it('fails for non-wsgi app', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: { provider: { runtime: 'python2.7' } },
        classes: { Error: Error }
      });

      return expect(plugin.hooks['wsgi:serve:serve']()).to.be.rejected;
    });

    it('executes python wrapper', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error }
      }, {});

      var stub = sinon.stub(child_process, 'spawnSync').returns({});
      plugin.hooks['wsgi:serve:serve']().then(() => {
        expect(stub.calledWith(
          'python2.7',
          [
            path.resolve(__dirname, 'serve.py'),
            '/tmp',
            'api.app',
            5000,
            'localhost'
          ],
          { stdio: 'inherit' }
        )).to.be.true;
        stub.restore();
      });
    });

    it('handles errors', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error }
      }, {});

      var stub = sinon.stub(child_process, 'spawnSync').returns({ error: 'Something failed' });
      expect(plugin.hooks['wsgi:serve:serve']()).to.eventually.be.rejected.and.notify(() => {
        expect(stub.calledWith(
          'python2.7',
          [
            path.resolve(__dirname, 'serve.py'),
            '/tmp',
            'api.app',
            5000,
            'localhost'
          ],
          { stdio: 'inherit' }
        )).to.be.true;
        stub.restore();
      });
    });

    it('allows changing port', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error }
      }, { port: 8000 });

      var stub = sinon.stub(child_process, 'spawnSync').returns({});
      plugin.hooks['wsgi:serve:serve']().then(() => {
        expect(stub.calledWith(
          'python2.7',
          [
            path.resolve(__dirname, 'serve.py'),
            '/tmp',
            'api.app',
            8000,
            'localhost'
          ],
          { stdio: 'inherit' }
        )).to.be.true;
        stub.restore();
      });
    });

    it('allows changing host', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error }
      }, { host: '0.0.0.0' });

      var stub = sinon.stub(child_process, 'spawnSync').returns({});
      plugin.hooks['wsgi:serve:serve']().then(() => {
        expect(stub.calledWith(
          'python2.7',
          [
            path.resolve(__dirname, 'serve.py'),
            '/tmp',
            'api.app',
            5000,
            '0.0.0.0'
          ],
          { stdio: 'inherit' }
        )).to.be.true;
        stub.restore();
      });
    });

    it('loads environment variables', () => {
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: {
            runtime: 'python2.7',
            environment: { SOME_ENV_VAR: 42, ANOTHER_ONE: { Ref: 'AWS::StackId' } }
          },
          functions: {
            func1: { handler: 'wsgi.handler', environment: { SECOND_VAR: 33 } },
            func2: { handler: 'x.x', environment: { THIRD_VAR: 66 } },
            func3: { handler: 'wsgi.handler' }
          },
          custom: { wsgi: { app: 'api.app' } }
        },
        classes: { Error: Error }
      }, { port: 8000 });

      var sandbox = sinon.sandbox.create();
      sandbox.stub(child_process, 'spawnSync').returns({});
      sandbox.stub(process, 'env').value({});
      plugin.hooks['wsgi:serve:serve']().then(() => {
        expect(process.env.SOME_ENV_VAR).to.equal(42);
        expect(process.env.SECOND_VAR).to.equal(33);
        expect(process.env.THIRD_VAR).to.be.undefined;
        expect(process.env.ANOTHER_ONE).to.be.undefined;
        sandbox.restore();
      });
    });
  });

  describe('clean', () => {
    it('cleans up everything', () => {
      var functions = {
        app: { handler: 'wsgi.handler' }
      };
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app' } },
          functions: functions
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, { functionObj: functions.app });

      var sandbox = sinon.sandbox.create();
      var removeStub = sandbox.stub(fse, 'removeAsync');
      var existsStub = sandbox.stub(fse, 'existsSync').returns(true);
      sandbox.stub(fse, 'readdirSync').returns(['flask']);
      var unlinkStub = sandbox.stub(fse, 'unlinkSync');
      plugin.hooks['wsgi:clean:clean']().then(() => {
        expect(existsStub.calledWith('/tmp/.requirements')).to.be.true;
        expect(unlinkStub.calledWith('flask')).to.be.true;
        expect(removeStub.calledWith('/tmp/wsgi.py')).to.be.true;
        expect(removeStub.calledWith('/tmp/.wsgi_app')).to.be.true;
        expect(removeStub.calledWith('/tmp/.requirements')).to.be.true;
        sandbox.restore();
      });
    });

    it('skips requirements cache if not enabled', () => {
      var functions = {
        app: { handler: 'wsgi.handler' }
      };
      var plugin = new Plugin({
        config: { servicePath: '/tmp' },
        service: {
          provider: { runtime: 'python2.7' },
          custom: { wsgi: { app: 'api.app', packRequirements: false } },
          functions: functions
        },
        classes: { Error: Error },
        cli: { log: () => {} }
      }, { functionObj: functions.app });

      var sandbox = sinon.sandbox.create();
      var removeStub = sandbox.stub(fse, 'removeAsync');
      var existsStub = sandbox.stub(fse, 'existsSync').returns(true);
      plugin.hooks['wsgi:clean:clean']().then(() => {
        expect(existsStub.calledWith('/tmp/.requirements')).to.be.false;
        expect(removeStub.calledWith('/tmp/wsgi.py')).to.be.true;
        expect(removeStub.calledWith('/tmp/.wsgi_app')).to.be.true;
        expect(removeStub.calledWith('/tmp/.requirements')).to.be.false;
        sandbox.restore();
      });
    });
  });
});
