'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const fse = require('fs-extra');
const child_process = require('child_process');

BbPromise.promisifyAll(fse);

class ServerlessWSGI {
  validate() {
    this.enableRequirements = true;
    this.pythonBin = this.serverless.service.provider.runtime;

    if (this.serverless.service.custom && this.serverless.service.custom.wsgi) {
      this.pythonBin = this.serverless.service.custom.wsgi.pythonBin || this.pythonBin;

      if (this.serverless.service.custom.wsgi.app) {
        this.wsgiApp = this.serverless.service.custom.wsgi.app;
        this.appPath = path.dirname(path.join(this.serverless.config.servicePath, this.wsgiApp));
      }

      if (this.serverless.service.custom.wsgi.packRequirements === false) {
        this.enableRequirements = false;
      }
    }

    this.serverless.service.package = this.serverless.service.package || {};
    this.serverless.service.package.include = this.serverless.service.package.include || [];
    this.serverless.service.package.exclude = this.serverless.service.package.exclude || [];

    this.serverless.service.package.include = _.union(
      this.serverless.service.package.include,
      ['wsgi.py', '.wsgi_app']);

    if (this.enableRequirements) {
      this.requirementsInstallPath = path.join(
        this.appPath ? this.appPath : this.serverless.config.servicePath,
        '.requirements');
      this.serverless.service.package.exclude.push('.requirements/**');
    }
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
    let args = [path.resolve(__dirname, 'requirements.py')];

    if (!this.enableRequirements) {
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

    args.push(this.requirementsInstallPath);

    this.serverless.cli.log('Packaging required Python packages...');

    return new BbPromise((resolve, reject) => {
      const res = child_process.spawnSync(this.pythonBin, args);
      if (res.error) {
        return reject(res.error);
      }
      if (res.status != 0) {
        return reject(res.stderr);
      }
      resolve();
    });
  }

  linkRequirements() {
    if (!this.enableRequirements) {
      return BbPromise.resolve();
    }

    if (fse.existsSync(this.requirementsInstallPath)) {
      this.serverless.cli.log('Linking required Python packages...');

      fse.readdirSync(this.requirementsInstallPath).map((file) => {
        this.serverless.service.package.include.push(file);
        this.serverless.service.package.include.push(`${file}/**`);

        try {
          fse.symlinkSync(`${this.requirementsInstallPath}/${file}`, file);
        } catch (exception) {
          let linkConflict = false;
          try {
            linkConflict = (fse.readlinkSync(file) !== `${this.requirementsInstallPath}/${file}`);
          } catch (e) {
            linkConflict = true;
          }
          if (linkConflict) {
            throw new this.serverless.classes.Error(
              `Unable to link dependency '${file}' ` +
              'because a file by the same name exists in this service');
          }
        }
      });
    }
  }

  unlinkRequirements() {
    if (!this.enableRequirements) {
      return BbPromise.resolve();
    }

    if (fse.existsSync(this.requirementsInstallPath)) {
      this.serverless.cli.log('Unlinking required Python packages...');

      fse.readdirSync(this.requirementsInstallPath).map((file) => {
        if (fse.existsSync(file)) {
          fse.unlinkSync(file);
        }
      });
    }
  }

  cleanRequirements() {
    if (!this.enableRequirements) {
      return BbPromise.resolve();
    }

    return fse.removeAsync(this.requirementsInstallPath);
  }

  cleanup() {
    const artifacts = ['wsgi.py', '.wsgi_app'];

    return BbPromise.all(_.map(artifacts, (artifact) =>
      fse.removeAsync(path.join(this.serverless.config.servicePath, artifact))));
  }

  loadEnvVars() {
    const providerEnvVars = _.omitBy(this.serverless.service.provider.environment || {}, _.isObject);
    _.merge(process.env, providerEnvVars);

    _.each(this.serverless.service.functions, (func) => {
      if (func.handler == 'wsgi.handler') {
        const functionEnvVars = _.omitBy(func.environment || {}, _.isObject);
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
    const host = this.options.host || 'localhost';

    return new BbPromise((resolve, reject) => {
      var status = child_process.spawnSync(this.pythonBin, [
        path.resolve(__dirname, 'serve.py'),
        this.serverless.config.servicePath,
        this.wsgiApp,
        port,
        host
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
              host: {
                usage: 'The server host, defaults to \'localhost\'.',
              },
            },
          },
          clean: {
            usage: 'Remove cached requirements.',
            lifecycleEvents: [
              'clean',
            ],
          },
        },
      },
    };

    this.hooks = {
      'before:package:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.packWsgiHandler)
        .then(this.packRequirements)
        .then(this.linkRequirements),

      'after:package:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.unlinkRequirements)
        .then(this.cleanup),

      'wsgi:serve:serve': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.loadEnvVars)
        .then(this.serve),

      'wsgi:clean:clean': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.unlinkRequirements)
        .then(this.cleanRequirements)
        .then(this.cleanup),

      'before:deploy:function:packageFunction': () => BbPromise.bind(this)
        .then(() => {
          if (this.options.functionObj.handler == 'wsgi.handler') {
            return BbPromise.bind(this)
              .then(this.validate)
              .then(this.packWsgiHandler)
              .then(this.packRequirements)
              .then(this.linkRequirements);
          } else {
            return BbPromise.bind(this)
              .then(this.validate)
              .then(this.packRequirements)
              .then(this.linkRequirements);
          }
        }),

      'after:deploy:function:packageFunction': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.unlinkRequirements)
        .then(this.cleanup)
    };
  }
}

module.exports = ServerlessWSGI;
