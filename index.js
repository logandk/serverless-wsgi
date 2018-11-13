"use strict";

const BbPromise = require("bluebird");
const _ = require("lodash");
const path = require("path");
const fse = require("fs-extra");
const child_process = require("child_process");
const hasbin = require("hasbin");

BbPromise.promisifyAll(fse);

class ServerlessWSGI {
  validate() {
    this.enableRequirements = true;

    if (this.serverless.service.custom && this.serverless.service.custom.wsgi) {
      if (this.serverless.service.custom.wsgi.app) {
        this.wsgiApp = this.serverless.service.custom.wsgi.app;
        this.appPath = path.dirname(
          path.join(this.serverless.config.servicePath, this.wsgiApp)
        );
      }

      if (this.serverless.service.custom.wsgi.packRequirements === false) {
        this.enableRequirements = false;
      }
    }

    if (this.enableRequirements) {
      this.requirementsInstallPath = path.join(
        this.appPath ? this.appPath : this.serverless.config.servicePath,
        ".requirements"
      );
    }

    return BbPromise.resolve();
  }

  configurePackaging() {
    this.serverless.service.package = this.serverless.service.package || {};
    this.serverless.service.package.include =
      this.serverless.service.package.include || [];
    this.serverless.service.package.exclude =
      this.serverless.service.package.exclude || [];

    this.serverless.service.package.include = _.union(
      this.serverless.service.package.include,
      ["wsgi.py", "serverless_wsgi.py", ".wsgi_app"]
    );

    if (this.enableRequirements) {
      this.serverless.service.package.exclude.push(".requirements/**");
    }

    return BbPromise.resolve();
  }

  locatePython() {
    if (
      this.serverless.service.custom &&
      this.serverless.service.custom.wsgi &&
      this.serverless.service.custom.wsgi.pythonBin
    ) {
      this.serverless.cli.log(
        `Using Python specified in "pythonBin": ${
          this.serverless.service.custom.wsgi.pythonBin
        }`
      );

      this.pythonBin = this.serverless.service.custom.wsgi.pythonBin;
      return BbPromise.resolve();
    }

    if (this.serverless.service.provider.runtime) {
      if (hasbin.sync(this.serverless.service.provider.runtime)) {
        this.serverless.cli.log(
          `Using Python specified in "runtime": ${
            this.serverless.service.provider.runtime
          }`
        );

        this.pythonBin = this.serverless.service.provider.runtime;
        return BbPromise.resolve();
      } else {
        this.serverless.cli.log(
          `Python executable not found for "runtime": ${
            this.serverless.service.provider.runtime
          }`
        );
      }
    }

    this.serverless.cli.log("Using default Python executable: python");

    this.pythonBin = "python";
    return BbPromise.resolve();
  }

  getWsgiHandlerConfiguration() {
    const config = { app: this.wsgiApp };

    if (_.isArray(this.serverless.service.custom.wsgi.textMimeTypes)) {
      config.text_mime_types = this.serverless.service.custom.wsgi.textMimeTypes;
    }

    return config;
  }

  packWsgiHandler(verbose = true) {
    if (!this.wsgiApp) {
      this.serverless.cli.log(
        "Warning: No WSGI app specified, omitting WSGI handler from package"
      );
      return BbPromise.resolve();
    }

    if (verbose) {
      this.serverless.cli.log("Packaging Python WSGI handler...");
    }

    return BbPromise.all([
      fse.copyAsync(
        path.resolve(__dirname, "wsgi.py"),
        path.join(this.serverless.config.servicePath, "wsgi.py")
      ),
      fse.copyAsync(
        path.resolve(__dirname, "serverless_wsgi.py"),
        path.join(this.serverless.config.servicePath, "serverless_wsgi.py")
      ),
      fse.writeFileAsync(
        path.join(this.serverless.config.servicePath, ".wsgi_app"),
        JSON.stringify(this.getWsgiHandlerConfiguration())
      )
    ]);
  }

  packRequirements() {
    const requirementsPath = this.appPath || this.serverless.config.servicePath;
    const requirementsFile = path.join(requirementsPath, "requirements.txt");
    let args = [path.resolve(__dirname, "requirements.py")];

    if (!this.enableRequirements) {
      return BbPromise.resolve();
    }

    if (this.wsgiApp) {
      args.push(path.resolve(__dirname, "requirements.txt"));
    }

    if (fse.existsSync(requirementsFile)) {
      args.push(requirementsFile);
    } else {
      if (!this.wsgiApp) {
        return BbPromise.resolve();
      }
    }

    args.push(this.requirementsInstallPath);

    this.serverless.cli.log("Packaging required Python packages...");

    return new BbPromise((resolve, reject) => {
      const res = child_process.spawnSync(this.pythonBin, args);
      if (res.error) {
        if (res.error.code == "ENOENT") {
          return reject(
            `Unable to run Python executable: ${
              this.pythonBin
            }. Use the "pythonBin" option to set your Python executable explicitly.`
          );
        } else {
          return reject(res.error);
        }
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
      this.serverless.cli.log("Linking required Python packages...");

      fse.readdirSync(this.requirementsInstallPath).map(file => {
        this.serverless.service.package.include.push(file);
        this.serverless.service.package.include.push(`${file}/**`);

        try {
          fse.symlinkSync(`${this.requirementsInstallPath}/${file}`, file);
        } catch (exception) {
          let linkConflict = false;
          try {
            linkConflict =
              fse.readlinkSync(file) !==
              `${this.requirementsInstallPath}/${file}`;
          } catch (e) {
            linkConflict = true;
          }
          if (linkConflict) {
            throw new this.serverless.classes.Error(
              `Unable to link dependency '${file}' ` +
                "because a file by the same name exists in this service"
            );
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
      this.serverless.cli.log("Unlinking required Python packages...");

      fse.readdirSync(this.requirementsInstallPath).map(file => {
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
    const artifacts = ["wsgi.py", "serverless_wsgi.py", ".wsgi_app"];

    return BbPromise.all(
      _.map(artifacts, artifact =>
        fse.removeAsync(path.join(this.serverless.config.servicePath, artifact))
      )
    );
  }

  loadEnvVars() {
    const providerEnvVars = _.omitBy(
      this.serverless.service.provider.environment || {},
      _.isObject
    );
    _.merge(process.env, providerEnvVars);

    _.each(this.serverless.service.functions, func => {
      if (func.handler == "wsgi.handler") {
        const functionEnvVars = _.omitBy(func.environment || {}, _.isObject);
        _.merge(process.env, functionEnvVars);
      }
    });

    return BbPromise.resolve();
  }

  serve() {
    if (!this.wsgiApp) {
      throw new this.serverless.classes.Error(
        'Missing WSGI app, please specify custom.wsgi.app. For instance, if you have a Flask application "app" in "api.py", set the Serverless custom.wsgi.app configuration option to: api.app'
      );
    }

    const port = this.options.port || 5000;
    const host = this.options.host || "localhost";

    return new BbPromise((resolve, reject) => {
      var status = child_process.spawnSync(
        this.pythonBin,
        [
          path.resolve(__dirname, "serve.py"),
          this.serverless.config.servicePath,
          this.wsgiApp,
          port,
          host
        ],
        { stdio: "inherit" }
      );
      if (status.error) {
        if (status.error.code == "ENOENT") {
          reject(
            `Unable to run Python executable: ${
              this.pythonBin
            }. Use the "pythonBin" option to set your Python executable explicitly.`
          );
        } else {
          reject(status.error);
        }
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
            usage: "Serve the WSGI application locally.",
            lifecycleEvents: ["serve"],
            options: {
              port: {
                usage: "The local server port, defaults to 5000.",
                shortcut: "p"
              },
              host: {
                usage: "The server host, defaults to 'localhost'."
              }
            }
          },
          install: {
            usage: "Install WSGI handler and requirements for local use.",
            lifecycleEvents: ["install"]
          },
          clean: {
            usage: "Remove cached requirements.",
            lifecycleEvents: ["clean"]
          }
        }
      }
    };

    const deployBeforeHook = () =>
      BbPromise.bind(this)
        .then(this.validate)
        .then(this.configurePackaging)
        .then(this.locatePython)
        .then(this.packWsgiHandler)
        .then(this.packRequirements)
        .then(this.linkRequirements);

    const deployBeforeHookWithoutHandler = () =>
      BbPromise.bind(this)
        .then(this.validate)
        .then(this.configurePackaging)
        .then(this.locatePython)
        .then(this.packRequirements)
        .then(this.linkRequirements);

    const deployAfterHook = () =>
      BbPromise.bind(this)
        .then(this.validate)
        .then(this.unlinkRequirements)
        .then(this.cleanup);

    this.hooks = {
      "wsgi:serve:serve": () =>
        BbPromise.bind(this)
          .then(this.validate)
          .then(this.locatePython)
          .then(this.loadEnvVars)
          .then(this.serve),

      "wsgi:install:install": deployBeforeHook,

      "wsgi:clean:clean": () => deployAfterHook().then(this.cleanRequirements),

      "before:package:createDeploymentArtifacts": deployBeforeHook,
      "after:package:createDeploymentArtifacts": deployAfterHook,

      "before:deploy:function:packageFunction": () => {
        if (this.options.functionObj.handler == "wsgi.handler") {
          return deployBeforeHook();
        } else {
          return deployBeforeHookWithoutHandler();
        }
      },
      "after:deploy:function:packageFunction": deployAfterHook,

      "before:offline:start:init": deployBeforeHook,
      "after:offline:start:end": deployAfterHook,

      "before:invoke:local:invoke": () => {
        const functionObj = this.serverless.service.getFunction(
          this.options.function
        );

        if (functionObj.handler == "wsgi.handler") {
          BbPromise.bind(this)
            .then(this.validate)
            .then(() => {
              return this.packWsgiHandler(false);
            });
        } else {
          return BbPromise.resolve();
        }
      },
      "after:invoke:local:invoke": () => BbPromise.bind(this).then(this.cleanup)
    };
  }
}

module.exports = ServerlessWSGI;
