'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const fse = require('fs-extra');
const child_process = require('child_process');

BbPromise.promisifyAll(fse);

class ServerlessWSGI {
  validate() {
    if (this.serverless.service.custom && this.serverless.service.custom.wsgi && this.serverless.service.custom.wsgi.app) {
      this.wsgiApp = this.serverless.service.custom.wsgi.app;
      this.appPath = path.dirname(path.join(this.serverless.config.servicePath, this.wsgiApp));
    }

    this.serverless.service.package = this.serverless.service.package || {};
    this.serverless.service.package.include = this.serverless.service.package.include || [];

    var includes = ['wsgi.py', '.wsgi_app'];
    if (this.serverless.service.custom.wsgi.packRequirements) {
      includes.push('.requirements/**');
    }

    this.serverless.service.package.include = _.union(
      this.serverless.service.package.include,
      includes
    );
  }

  packWsgiHandler() {
    if (!this.wsgiApp) {
      this.serverless.cli.log('Warning: No WSGI app specified, omitting WSGI handler from package');
      return BbPromise.resolve();
    }

    this.serverless.cli.log('Packaging Python WSGI handler...');

    return BbPromise.all([
      fse.copyAsync(
        path.resolve(__dirname, 'wsgi.py'),
        path.join(this.serverless.config.servicePath, 'wsgi.py')),
      fse.writeFileAsync(
        path.join(this.serverless.config.servicePath, '.wsgi_app'),
        this.wsgiApp)
    ]);
  }

  packRequirements() {
    const requirementsPath = this.appPath || this.serverless.config.servicePath;
    const requirementsFile = path.join(requirementsPath, 'requirements.txt');
    const requirementsInstallPath = this.appPath ? this.appPath : this.serverless.config.servicePath;
    let args = [path.resolve(__dirname, 'requirements.py')];

    if (this.serverless.service.custom && this.serverless.service.custom.wsgi && this.serverless.service.custom.wsgi.packRequirements == false) {
      return BbPromise.resolve();
    }

    if (this.wsgiApp) {
      args.push(path.resolve(__dirname, 'requirements.txt'));
    }

    if (fse.existsSync(requirementsFile)) {
      args.push(requirementsFile);
    } else {
      if (!this.wsgiApp) {
        return BbPromise.resolve();
      }
    }

    args.push(path.join(requirementsInstallPath, '.requirements'));

    this.serverless.cli.log('Packaging required Python packages...');

    return new BbPromise((resolve, reject) => {
      const res = child_process.spawnSync('python', args);
      if (res.error) {
        return reject(res.error);
      }
      if (res.status != 0) {
        return reject(res.stderr);
      }
      resolve();
    });
  }

  cleanup() {
    const artifacts = ['wsgi.py', '.wsgi_app'];
    if (this.serverless.service.custom && this.serverless.service.custom.wsgi && (this.serverless.service.custom.wsgi.packRequirements !== false)) {
      artifacts.push('.requirements');
    }

    return BbPromise.all(_.map(artifacts, (artifact) =>
      fse.removeAsync(path.join(this.serverless.config.servicePath, artifact))));
  }

  loadEnvVars() {
    const providerEnvVars = this.serverless.service.provider.environment || {};
    _.merge(process.env, providerEnvVars);

    _.each(this.serverless.service.functions, function (func) {
      if (func.handler == 'wsgi.handler') {
        const functionEnvVars = func.environment || {};
        _.merge(process.env, functionEnvVars);
      }
    });

    return BbPromise.resolve();
  }

  serve() {
    if (!this.wsgiApp) {
      throw new this.serverless.classes.Error(
        'Missing WSGI app, please specify custom.wsgi.app. For instance, if you have a Flask application "app" in "api.py", set the Serverless custom.wsgi.app configuration option to: api.app');
    }

    const port = this.options.port || 5000;

    return new BbPromise((resolve, reject) => {
      var status = child_process.spawnSync('python', [
        path.resolve(__dirname, 'serve.py'),
        this.serverless.config.servicePath,
        this.wsgiApp,
        port
      ], { stdio: 'inherit' });
      if (status.error) {
        reject(status.error);
      } else {
        resolve();
      }
    });
  }

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      wsgi: {
        commands: {
          serve: {
            usage: 'Serve the WSGI application locally.',
            lifecycleEvents: [
              'serve',
            ],
            options: {
              port: {
                usage: 'The local server port, defaults to 5000.',
                shortcut: 'p',
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'before:deploy:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.packWsgiHandler)
        .then(this.packRequirements),

      'after:deploy:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.cleanup),

      'wsgi:serve:serve': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.loadEnvVars)
        .then(this.serve),

      'before:deploy:function:packageFunction': () => BbPromise.bind(this)
        .then(() => {
          if (this.options.functionObj.handler == 'wsgi.handler') {
            return BbPromise.bind(this)
              .then(this.validate)
              .then(this.packWsgiHandler)
              .then(this.packRequirements);
          }
        }),

      'after:deploy:function:packageFunction': () => BbPromise.bind(this)
        .then(this.cleanup)
    };
  }
}

module.exports = ServerlessWSGI;
