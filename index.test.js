"use strict";

const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const Plugin = require("./index");
const child_process = require("child_process");
const path = require("path");
const fse = require("fs-extra");
const commandExists = require("command-exists");
const BbPromise = require("bluebird");

const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

describe("serverless-wsgi", () => {
  describe("init", () => {
    it("registers commands", () => {
      var plugin = new Plugin();

      expect(plugin.commands.wsgi.commands.serve.lifecycleEvents).to.include(
        "serve"
      );
    });

    it("registers hooks", () => {
      var plugin = new Plugin();

      expect(plugin.hooks["before:package:createDeploymentArtifacts"]).to.be.a(
        "function"
      );
      expect(plugin.hooks["after:package:createDeploymentArtifacts"]).to.be.a(
        "function"
      );
      expect(plugin.hooks["wsgi:serve:serve"]).to.be.a("function");
      expect(plugin.hooks["wsgi:install:install"]).to.be.a("function");
      expect(plugin.hooks["wsgi:clean:clean"]).to.be.a("function");
      expect(plugin.hooks["before:offline:start:init"]).to.be.a("function");
      expect(plugin.hooks["after:offline:start:end"]).to.be.a("function");
      expect(plugin.hooks["before:invoke:local:invoke"]).to.be.a("function");
      expect(plugin.hooks["after:invoke:local:invoke"]).to.be.a("function");
    });

    it("generates help for default command", () => {
      var plugin = new Plugin(
        {
          cli: {
            generateCommandsHelp: (command) => {
              expect(command).to.deep.equal(["wsgi"]);
            },
          },
        },
        {}
      );

      expect(plugin.hooks["wsgi:wsgi"]()).to.be.fulfilled;
    });
  });

  describe("wsgi", () => {
    it("skips packaging for non-wsgi app", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var procStub = sandbox.stub(child_process, "spawnSync");
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(copyStub.called).to.be.false;
          expect(writeStub.called).to.be.false;
          expect(procStub.called).to.be.false;
          sandbox.restore();
        }
      );
    });

    it("packages wsgi handler", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(
            copyStub.calledWith(
              path.resolve(__dirname, "wsgi_handler.py"),
              "/tmp/wsgi_handler.py"
            )
          ).to.be.true;
          expect(
            copyStub.calledWith(
              path.resolve(__dirname, "serverless_wsgi.py"),
              "/tmp/serverless_wsgi.py"
            )
          ).to.be.true;
          expect(writeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
          expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({
            app: "api.app",
          });
          expect(
            procStub.calledWith("python2.7", [
              path.resolve(__dirname, "requirements.py"),
              path.resolve(__dirname, "requirements.txt"),
              "/tmp/.requirements",
            ])
          ).to.be.true;
          sandbox.restore();
          expect(plugin.serverless.service.package.patterns).to.have.members([
            "wsgi_handler.py",
            "serverless_wsgi.py",
            ".serverless-wsgi",
            "!.requirements/**",
          ]);
        }
      );
    });

    it("packages wsgi handler with additional text mime types", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: {
              wsgi: {
                app: "api.app",
                textMimeTypes: ["application/custom+json"],
              },
            },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(child_process, "spawnSync").returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(writeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
          expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({
            app: "api.app",
            text_mime_types: ["application/custom+json"],
          });
          sandbox.restore();
        }
      );
    });

    it("falls back to default python if runtime version is not found", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python3.6" },
            custom: {
              wsgi: {
                app: "api.app",
              },
            },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(false);
      sandbox.stub(fse, "copyAsync");
      sandbox.stub(fse, "writeFileAsync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python3.6")).to.be.true;
          expect(
            procStub.calledWith("python", [
              path.resolve(__dirname, "requirements.py"),
              path.resolve(__dirname, "requirements.txt"),
              "/tmp/.requirements",
            ])
          ).to.be.true;
          sandbox.restore();
        }
      );
    });

    it("cleans up after deployment", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      return plugin.hooks["after:package:createDeploymentArtifacts"]().then(
        () => {
          expect(removeStub.calledWith("/tmp/wsgi_handler.py")).to.be.true;
          expect(removeStub.calledWith("/tmp/serverless_wsgi.py")).to.be.true;
          expect(removeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
          expect(removeStub.calledWith("/tmp/.requirements")).to.be.false;
          sandbox.restore();
        }
      );
    });

    it("packages wsgi handler with individual include and exclude patterns", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            package: { individually: true },
            custom: { wsgi: { app: "web/api.app" } },
            functions: {
              api: { handler: "wsgi.handler" },
            },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var symlinkStub = sandbox.stub(fse, "symlinkSync");
      sandbox.stub(fse, "readdirSync").returns(["flask", "werkzeug"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(
            copyStub.calledWith(
              path.resolve(__dirname, "wsgi_handler.py"),
              "/tmp/wsgi_handler.py"
            )
          ).to.be.true;
          expect(
            copyStub.calledWith(
              path.resolve(__dirname, "serverless_wsgi.py"),
              "/tmp/serverless_wsgi.py"
            )
          ).to.be.true;
          expect(writeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
          expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({
            app: "web/api.app",
          });
          expect(symlinkStub.called).to.be.true;
          expect(
            procStub.calledWith("python2.7", [
              path.resolve(__dirname, "requirements.py"),
              path.resolve(__dirname, "requirements.txt"),
              "/tmp/web/requirements.txt",
              "/tmp/web/.requirements",
            ])
          ).to.be.true;
          sandbox.restore();
          expect(plugin.serverless.service.package.patterns).to.have.members([
            "wsgi_handler.py",
            "serverless_wsgi.py",
            ".serverless-wsgi",
            "web/flask",
            "web/flask/**",
            "web/werkzeug",
            "web/werkzeug/**",
            "!web/.requirements/**",
          ]);
        }
      );
    });

    it("packages wsgi handler in individually packaged modules by serverless-python-requirements", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            package: { individually: true },
            custom: { wsgi: { app: "web/api.app" } },
            functions: {
              api: { handler: "wsgi.handler", module: "web" },
            },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var symlinkStub = sandbox.stub(fse, "symlinkSync");
      sandbox.stub(fse, "readdirSync").returns(["flask", "werkzeug"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(
            copyStub.calledWith(
              path.resolve(__dirname, "wsgi_handler.py"),
              "/tmp/web/wsgi_handler.py"
            )
          ).to.be.true;
          expect(
            copyStub.calledWith(
              path.resolve(__dirname, "serverless_wsgi.py"),
              "/tmp/web/serverless_wsgi.py"
            )
          ).to.be.true;
          expect(writeStub.calledWith("/tmp/web/.serverless-wsgi")).to.be.true;
          expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({
            app: "api.app",
          });
          expect(symlinkStub.called).to.be.true;
          expect(
            procStub.calledWith("python2.7", [
              path.resolve(__dirname, "requirements.py"),
              path.resolve(__dirname, "requirements.txt"),
              "/tmp/web/requirements.txt",
              "/tmp/web/.requirements",
            ])
          ).to.be.true;
          sandbox.restore();
          expect(plugin.serverless.service.package.patterns).to.have.members([
            "web/wsgi_handler.py",
            "web/serverless_wsgi.py",
            "web/.serverless-wsgi",
            "web/flask",
            "web/flask/**",
            "web/werkzeug",
            "web/werkzeug/**",
            "!web/.requirements/**",
          ]);
        }
      );
    });
  });

  describe("requirements", () => {
    it("packages user requirements for wsgi app", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            package: { patterns: ["sample.txt"] },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var symlinkStub = sandbox.stub(fse, "symlinkSync");
      sandbox.stub(fse, "readdirSync").returns(["flask", "werkzeug"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(copyStub.called).to.be.true;
          expect(writeStub.called).to.be.true;
          expect(symlinkStub.called).to.be.true;
          expect(
            procStub.calledWith("python2.7", [
              path.resolve(__dirname, "requirements.py"),
              path.resolve(__dirname, "requirements.txt"),
              "/tmp/requirements.txt",
              "/tmp/.requirements",
            ])
          ).to.be.true;
          expect(plugin.serverless.service.package.patterns).to.have.members([
            "sample.txt",
            "wsgi_handler.py",
            "serverless_wsgi.py",
            ".serverless-wsgi",
            "!.requirements/**",
            "flask",
            "flask/**",
            "werkzeug",
            "werkzeug/**",
          ]);
          sandbox.restore();
        }
      );
    });

    it("allows setting the python binary", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app", pythonBin: "my-python" } },
            package: { patterns: ["sample.txt"] },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var symlinkStub = sandbox.stub(fse, "symlinkSync");
      sandbox.stub(fse, "readdirSync").returns(["flask"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.called).to.be.false;
          expect(copyStub.called).to.be.true;
          expect(writeStub.called).to.be.true;
          expect(symlinkStub.called).to.be.true;
          expect(
            procStub.calledWith("my-python", [
              path.resolve(__dirname, "requirements.py"),
              path.resolve(__dirname, "requirements.txt"),
              "/tmp/requirements.txt",
              "/tmp/.requirements",
            ])
          ).to.be.true;
          expect(plugin.serverless.service.package.patterns).to.have.members([
            "sample.txt",
            "wsgi_handler.py",
            "serverless_wsgi.py",
            ".serverless-wsgi",
            "flask",
            "flask/**",
            "!.requirements/**",
          ]);
          sandbox.restore();
        }
      );
    });

    it("packages user requirements for wsgi app inside directory", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: {},
            custom: { wsgi: { app: "api/api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "symlinkSync");
      sandbox.stub(fse, "readdirSync").returns(["werkzeug"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(copyStub.called).to.be.true;
          expect(writeStub.called).to.be.true;
          expect(
            procStub.calledWith("python", [
              path.resolve(__dirname, "requirements.py"),
              path.resolve(__dirname, "requirements.txt"),
              "/tmp/api/requirements.txt",
              "/tmp/api/.requirements",
            ])
          ).to.be.true;
          expect(plugin.serverless.service.package.patterns).to.have.members([
            "wsgi_handler.py",
            "serverless_wsgi.py",
            ".serverless-wsgi",
            "api/werkzeug",
            "api/werkzeug/**",
            "!api/.requirements/**",
          ]);
          sandbox.restore();
        }
      );
    });

    it("throws an error when a file already exists in the service root", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(commandExists, "sync").returns(true);
      sandbox.stub(fse, "copyAsync");
      sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "symlinkSync").throws();
      sandbox.stub(fse, "readlinkSync").throws();
      sandbox.stub(fse, "readdirSync").returns(["flask"]);
      sandbox.stub(fse, "existsSync").returns(true);
      sandbox.stub(child_process, "spawnSync").returns({ status: 0 });
      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("throws an error when a conflicting symlink already exists in the service root", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(commandExists, "sync").returns(true);
      sandbox.stub(fse, "copyAsync");
      sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "symlinkSync").throws();
      sandbox.stub(fse, "readlinkSync").returns("not-flask");
      sandbox.stub(fse, "readdirSync").returns(["flask"]);
      sandbox.stub(fse, "existsSync").returns(true);
      sandbox.stub(child_process, "spawnSync").returns({ status: 0 });
      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("packages user requirements for non-wsgi app", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "symlinkSync").throws();
      sandbox.stub(fse, "readlinkSync").returns("/tmp/.requirements/flask");
      sandbox.stub(fse, "readdirSync").returns(["flask"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(copyStub.called).to.be.false;
          expect(writeStub.called).to.be.false;
          expect(
            procStub.calledWith("python2.7", [
              path.resolve(__dirname, "requirements.py"),
              "/tmp/requirements.txt",
              "/tmp/.requirements",
            ])
          ).to.be.true;
          sandbox.restore();
        }
      );
    });

    it("packages user requirements with additional pip args", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python3.6" },
            custom: { wsgi: { pipArgs: "--no-deps 'imaginary \"value\"'" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "symlinkSync").throws();
      sandbox.stub(fse, "readlinkSync").returns("/tmp/.requirements/flask");
      sandbox.stub(fse, "readdirSync").returns(["flask"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python3.6")).to.be.true;
          expect(copyStub.called).to.be.false;
          expect(writeStub.called).to.be.false;
          expect(
            procStub.calledWith("python3.6", [
              path.resolve(__dirname, "requirements.py"),
              "--pip-args",
              "--no-deps 'imaginary \"value\"'",
              "/tmp/requirements.txt",
              "/tmp/.requirements",
            ])
          ).to.be.true;
          sandbox.restore();
        }
      );
    });

    it("skips packaging for non-wsgi app without user requirements", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "existsSync").returns(false);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(copyStub.called).to.be.false;
          expect(writeStub.called).to.be.false;
          expect(procStub.called).to.be.false;
          expect(plugin.serverless.service.package.patterns).to.have.members([
            "wsgi_handler.py",
            "serverless_wsgi.py",
            ".serverless-wsgi",
            "!.requirements/**",
          ]);
          sandbox.restore();
        }
      );
    });

    it("rejects with non successful exit code", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(commandExists, "sync").returns(true);
      sandbox.stub(fse, "existsSync").returns(true);
      sandbox.stub(child_process, "spawnSync").returns({ status: 1 });

      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("rejects with stderr output", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(commandExists, "sync").returns(true);
      sandbox.stub(fse, "existsSync").returns(true);
      sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0, error: "fail" });

      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("handles missing Python binary error", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(commandExists, "sync").returns(true);
      sandbox.stub(fse, "existsSync").returns(true);
      sandbox
        .stub(child_process, "spawnSync")
        .returns({ error: { code: "ENOENT" } });

      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("skips packaging if disabled", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app", packRequirements: false } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(copyStub.called).to.be.true;
          expect(writeStub.called).to.be.true;
          expect(existsStub.called).to.be.false;
          expect(procStub.called).to.be.false;
          expect(
            plugin.serverless.service.package.patterns
          ).not.to.have.members([".requirements/**"]);
          sandbox.restore();
        }
      );
    });

    it("skips requirements cleanup if disabled", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app", packRequirements: false } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      return plugin.hooks["after:package:createDeploymentArtifacts"]().then(
        () => {
          expect(removeStub.calledWith("/tmp/wsgi_handler.py")).to.be.true;
          expect(removeStub.calledWith("/tmp/serverless_wsgi.py")).to.be.true;
          expect(removeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
          expect(removeStub.calledWith("/tmp/.requirements")).to.be.false;
          sandbox.restore();
        }
      );
    });

    it("skips packaging if serverless-python-requirements is present", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            plugins: ["serverless-wsgi", "serverless-python-requirements"],
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:package:createDeploymentArtifacts"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(copyStub.called).to.be.true;
          expect(writeStub.called).to.be.true;
          expect(existsStub.called).to.be.false;
          expect(procStub.called).to.be.false;
          expect(
            plugin.serverless.service.package.patterns
          ).not.to.have.members([".requirements/**"]);
          sandbox.restore();
        }
      );
    });
  });

  describe("function deployment", () => {
    it("skips packaging for non-wsgi function", () => {
      var functions = {
        app: {},
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: functions,
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:deploy:function:packageFunction"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(copyStub.called).to.be.false;
          expect(writeStub.called).to.be.false;
          expect(procStub.called).to.be.true;
          sandbox.restore();
        }
      );
    });

    it("packages wsgi handler", () => {
      var functions = {
        app: { handler: "wsgi_handler.handler" },
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: functions,
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "readdirSync").returns([]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["before:deploy:function:packageFunction"]().then(
        () => {
          expect(commandExistsStub.calledWith("python2.7")).to.be.true;
          expect(
            copyStub.calledWith(
              path.resolve(__dirname, "wsgi_handler.py"),
              "/tmp/wsgi_handler.py"
            )
          ).to.be.true;
          expect(
            copyStub.calledWith(
              path.resolve(__dirname, "serverless_wsgi.py"),
              "/tmp/serverless_wsgi.py"
            )
          ).to.be.true;
          expect(writeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
          expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({
            app: "api.app",
          });
          expect(
            procStub.calledWith("python2.7", [
              path.resolve(__dirname, "requirements.py"),
              path.resolve(__dirname, "requirements.txt"),
              "/tmp/requirements.txt",
              "/tmp/.requirements",
            ])
          ).to.be.true;
          sandbox.restore();
        }
      );
    });

    it("cleans up after deployment", () => {
      var functions = {
        app: { handler: "wsgi_handler.handler" },
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: functions,
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      var existsStub = sandbox.stub(fse, "existsSync").returns(true);
      existsStub.withArgs("werkzeug").returns(false);
      sandbox.stub(fse, "readdirSync").returns(["flask", "werkzeug"]);
      var unlinkStub = sandbox.stub(fse, "unlinkSync");
      return plugin.hooks["after:deploy:function:packageFunction"]().then(
        () => {
          expect(existsStub.calledWith("/tmp/.requirements")).to.be.true;
          expect(unlinkStub.calledWith("flask")).to.be.true;
          expect(unlinkStub.calledWith("werkzeug")).to.be.false;
          expect(removeStub.calledWith("/tmp/wsgi_handler.py")).to.be.true;
          expect(removeStub.calledWith("/tmp/serverless_wsgi.py")).to.be.true;
          expect(removeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
          expect(removeStub.calledWith("/tmp/.requirements")).to.be.false;
          sandbox.restore();
        }
      );
    });
  });

  describe("serve", () => {
    it("fails for non-wsgi app", () => {
      var plugin = new Plugin({
        config: { servicePath: "/tmp" },
        service: { provider: { runtime: "python2.7" } },
        classes: { Error: Error },
        cli: { log: () => { } },
      });

      return expect(plugin.hooks["wsgi:serve:serve"]()).to.be.rejected;
    });

    it("executes python wrapper", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      return plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(commandExistsStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "localhost",
            ],
            { stdio: "inherit" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("handles process errors", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ error: "Something failed" });
      return expect(
        plugin.hooks["wsgi:serve:serve"]()
      ).to.eventually.be.rejected.and.notify(() => {
        expect(commandExistsStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "localhost",
            ],
            { stdio: "inherit" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("handles missing Python binary error", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ error: { code: "ENOENT" } });
      return expect(
        plugin.hooks["wsgi:serve:serve"]()
      ).to.eventually.be.rejected.and.notify(() => {
        expect(commandExistsStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "localhost",
            ],
            { stdio: "inherit" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("allows changing port", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { port: 8000 }
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      return plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(commandExistsStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              8000,
              "localhost",
            ],
            { stdio: "inherit" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("allows changing host", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { host: "0.0.0.0" }
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      return plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(commandExistsStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "0.0.0.0",
            ],
            { stdio: "inherit" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("allows disabling threading", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { "disable-threading": true }
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      return plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(commandExistsStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "localhost",
              "--disable-threading",
            ],
            { stdio: "inherit" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("allows multiple processes", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { "num-processes": 10 }
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      return plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(commandExistsStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "localhost",
              "--num-processes",
              10,
            ],
            { stdio: "inherit" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("allows serving over https", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { ssl: true }
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      return plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(commandExistsStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "localhost",
              "--ssl",
            ],
            { stdio: "inherit" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("loads environment variables", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: {
              runtime: "python2.7",
              environment: {
                SOME_ENV_VAR: 42,
                ANOTHER_ONE: { Ref: "AWS::StackId" },
              },
            },
            functions: {
              func1: {
                handler: "wsgi_handler.handler",
                environment: { SECOND_VAR: 33 },
              },
              func2: { handler: "x.x", environment: { THIRD_VAR: 66 } },
              func3: { handler: "wsgi_handler.handler" },
            },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { port: 8000 }
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(commandExists, "sync").returns(true);
      sandbox.stub(child_process, "spawnSync").returns({});
      sandbox.stub(process, "env").value({});
      return plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(process.env.SOME_ENV_VAR).to.equal(42);
        expect(process.env.SECOND_VAR).to.equal(33);
        expect(process.env.THIRD_VAR).to.be.undefined;
        expect(process.env.ANOTHER_ONE).to.be.undefined;
        sandbox.restore();
      });
    });

    it("loads wsgi app from individually packed module", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            package: { individually: true },
            custom: { wsgi: { app: "site/api.app" } },
            functions: {
              api: { handler: "wsgi.handler", module: "site" },
            },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      return plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(commandExistsStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp/site",
              "api.app",
              5000,
              "localhost",
            ],
            { stdio: "inherit" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("install", () => {
    it("installs handler and requirements", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var commandExistsStub = sandbox.stub(commandExists, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "readdirSync").returns([]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      return plugin.hooks["wsgi:install:install"]().then(() => {
        expect(commandExistsStub.calledWith("python2.7")).to.be.true;
        expect(
          copyStub.calledWith(
            path.resolve(__dirname, "wsgi_handler.py"),
            "/tmp/wsgi_handler.py"
          )
        ).to.be.true;
        expect(
          copyStub.calledWith(
            path.resolve(__dirname, "serverless_wsgi.py"),
            "/tmp/serverless_wsgi.py"
          )
        ).to.be.true;
        expect(writeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
        expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({
          app: "api.app",
        });
        expect(
          procStub.calledWith("python2.7", [
            path.resolve(__dirname, "requirements.py"),
            path.resolve(__dirname, "requirements.txt"),
            "/tmp/requirements.txt",
            "/tmp/.requirements",
          ])
        ).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("clean", () => {
    it("cleans up everything", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      var existsStub = sandbox.stub(fse, "existsSync").returns(true);
      sandbox.stub(fse, "readdirSync").returns(["flask"]);
      var unlinkStub = sandbox.stub(fse, "unlinkSync");
      return plugin.hooks["wsgi:clean:clean"]().then(() => {
        expect(existsStub.calledWith("/tmp/.requirements")).to.be.true;
        expect(unlinkStub.calledWith("flask")).to.be.true;
        expect(removeStub.calledWith("/tmp/wsgi_handler.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_wsgi.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
        expect(removeStub.calledWith("/tmp/.requirements")).to.be.true;
        sandbox.restore();
      });
    });

    it("skips cleaning requirements if packaging not enabled", () => {
      var functions = {
        app: { handler: "wsgi_handler.handler" },
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app", packRequirements: false } },
            functions: functions,
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      var existsStub = sandbox.stub(fse, "existsSync").returns(true);
      return plugin.hooks["wsgi:clean:clean"]().then(() => {
        expect(existsStub.calledWith("/tmp/.requirements")).to.be.false;
        expect(removeStub.calledWith("/tmp/wsgi_handler.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_wsgi.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
        expect(removeStub.calledWith("/tmp/.requirements")).to.be.false;
        sandbox.restore();
      });
    });
  });

  describe("exec", () => {
    const mockCli = Object({ log: () => { } });

    it("fails when invoked without command or file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        {}
      );

      expect(plugin.hooks["wsgi:exec:exec"]()).to.be.rejectedWith(
        "Please provide either a command (-c) or a file (-f)"
      );
    });

    it("calls handler to execute code remotely from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('[0, "5"]'); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { command: "print(1+4)" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      return plugin.hooks["wsgi:exec:exec"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.c).to.be.undefined;
        expect(plugin.serverless.pluginManager.cliOptions.context).to.be
          .undefined;
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(loggerSpy.calledWith("5")).to.be.true;
        sandbox.restore();
      });
    });

    it("calls handler to execute code remotely from file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('[0, {"response": "5"}]'); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { file: "script.py" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      sandbox.stub(fse, "readFileSync").returns("print(1+4)");
      return plugin.hooks["wsgi:exec:exec"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(loggerSpy.calledWith({ response: "5" })).to.be.true;
        sandbox.restore();
      });
    });

    it("handles unsuccessful exit from command", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('[1, "Error"]'); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { command: "print(1+4)" }
      );

      return expect(plugin.hooks["wsgi:exec:exec"]()).to.be.rejectedWith(
        "Error"
      );
    });
  });

  describe("exec local", () => {
    const mockCli = { log: () => { } };

    it("fails when invoked without command or file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: mockCli,
        },
        {}
      );

      return expect(plugin.hooks["wsgi:exec:local:exec"]()).to.be.rejectedWith(
        "Please provide either a command (-c) or a file (-f)"
      );
    });

    it("calls handler to execute code locally from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke", "local"]);
                console.log('[0, "5"]'); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { command: "print(1+4)" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      return plugin.hooks["wsgi:exec:local:exec"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.c).to.be.undefined;
        expect(plugin.serverless.pluginManager.cliOptions.context).to.be
          .undefined;
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(loggerSpy.calledWith("5")).to.be.true;
        sandbox.restore();
      });
    });

    it("calls handler to execute code locally from file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke", "local"]);
                console.log('[0, {"response": "5"}]'); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { file: "script.py" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      sandbox.stub(fse, "readFileSync").returns("print(1+4)");
      return plugin.hooks["wsgi:exec:local:exec"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(loggerSpy.calledWith({ response: "5" })).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("command", () => {
    const mockCli = { log: () => { } };

    it("fails when no wsgi handler is set", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "other.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
        },
        { command: "pwd" }
      );

      return expect(plugin.hooks["wsgi:command:command"]()).to.be.rejectedWith(
        "No functions were found with handler: wsgi_handler.handler"
      );
    });

    it("fails when invoked without command or file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: mockCli,
        },
        {}
      );

      return expect(plugin.hooks["wsgi:command:command"]()).to.be.rejectedWith(
        "Please provide either a command (-c) or a file (-f)"
      );
    });

    it("calls handler to execute commands remotely from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke"]);
                console.log("non-json output"); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { command: "pwd" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      return plugin.hooks["wsgi:command:command"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.c).to.be.undefined;
        expect(plugin.serverless.pluginManager.cliOptions.context).to.be
          .undefined;
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(loggerSpy.calledWith("non-json output")).to.be.true;
        sandbox.restore();
      });
    });

    it("calls handler to execute commands remotely from file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('[0, "/var/task"]'); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { file: "script.sh" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      sandbox.stub(fse, "readFileSync").returns("pwd");
      return plugin.hooks["wsgi:command:command"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(loggerSpy.calledWith("/var/task")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("command local", () => {
    const mockCli = { log: () => { } };

    it("fails when no wsgi handler is set", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "other.handler" } },
          },
          classes: { Error: Error },
          cli: { mockCli },
        },
        { command: "pwd" }
      );

      return expect(
        plugin.hooks["wsgi:command:local:command"]()
      ).to.be.rejectedWith(
        "No functions were found with handler: wsgi_handler.handler"
      );
    });

    it("fails when invoked without command or file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
          },
          classes: { Error: Error },
          cli: { mockCli },
        },
        {}
      );

      return expect(
        plugin.hooks["wsgi:command:local:command"]()
      ).to.be.rejectedWith(
        "Please provide either a command (-c) or a file (-f)"
      );
    });

    it("calls handler to execute commands remotely from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke", "local"]);
                mockCli.log("non-json output"); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { command: "pwd" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      return plugin.hooks["wsgi:command:local:command"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.c).to.be.undefined;
        expect(plugin.serverless.pluginManager.cliOptions.context).to.be
          .undefined;
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(loggerSpy.calledWith("non-json output")).to.be.true;
        sandbox.restore();
      });
    });

    it("calls handler to execute commands remotely from file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke", "local"]);
                console.log('[0, "/var/task"]'); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { file: "script.sh" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      sandbox.stub(fse, "readFileSync").returns("pwd");
      return plugin.hooks["wsgi:command:local:command"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(loggerSpy.calledWith("/var/task")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("manage", () => {
    const mockCli = {
      log: sinon.spy(),
    };

    let plugin;
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: {
              app: { handler: "wsgi_handler.handler" },
              otherFunc: { handler: "other_handler.handler" },
            },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: sandbox.stub().resolves(),
          },
        },
        { command: "check" }
      );
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("calls handler to execute manage commands remotely from argument", () => {
      plugin.serverless.pluginManager.run.callsFake((command) => {
        expect(command).to.deep.equal(["invoke"]);
        console.log('[0, "manage command output"]');
        return BbPromise.resolve();
      });

      return plugin.hooks["wsgi:manage:manage"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"manage","data":"check"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"manage","data":"check"}}'
        );
        expect(mockCli.log.calledWith("manage command output")).to.be.true;
      });
    });

    it("uses the function specified by --function", () => {
      plugin.options.function = "otherFunc";

      return plugin.hooks["wsgi:manage:manage"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal(
          "otherFunc"
        );
        expect(plugin.options.function).to.equal("otherFunc");
      });
    });

    it("uses the function specified by -f", () => {
      plugin.options.f = "otherFunc";

      return plugin.hooks["wsgi:manage:manage"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal(
          "otherFunc"
        );
        expect(plugin.options.function).to.equal("otherFunc");
      });
    });

    it("throws an error when specified function is not found", () => {
      plugin.options.function = "nonExistentFunc";

      return expect(plugin.hooks["wsgi:manage:manage"]()).to.be.rejectedWith(
        'Function "nonExistentFunc" not found.'
      );
    });

    it("falls back to finding wsgi handler when no function is specified", () => {
      delete plugin.options.function;
      delete plugin.options.f;

      return plugin.hooks["wsgi:manage:manage"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
      });
    });

    it("rejects when no wsgi handler is found and no function is specified", () => {
      delete plugin.options.function;
      delete plugin.options.f;
      plugin.serverless.service.functions = {
        someFunc: { handler: "some_handler.handler" },
      };

      return expect(plugin.hooks["wsgi:manage:manage"]()).to.be.rejectedWith(
        "No functions were found with handler: wsgi_handler.handler"
      );
    });
  });

  describe("manage local", () => {
    const mockCli = Object({ log: () => { } });

    it("calls handler to execute manage commands locally from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke", "local"]);
                console.log('[0, "manage command output"]'); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { command: "check" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      return plugin.hooks["wsgi:manage:local:manage"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.c).to.be.undefined;
        expect(plugin.serverless.pluginManager.cliOptions.context).to.be
          .undefined;
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"manage","data":"check"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"manage","data":"check"}}'
        );
        expect(loggerSpy.calledWith("manage command output")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("flask", () => {
    const mockCli = Object({ log: () => { } });
    it("calls handler to execute flask commands remotely from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('[0, "flask command output"]'); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { command: "check" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      return plugin.hooks["wsgi:flask:flask"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"flask","data":"check"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"flask","data":"check"}}'
        );
        expect(loggerSpy.calledWith("flask command output")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("flask local", () => {
    const mockCli = Object({ log: () => { } });
    it("calls handler to execute flask commands locally from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } },
          },
          classes: { Error: Error },
          cli: mockCli,
          pluginManager: {
            cliOptions: {},
            run: (command) =>
              new BbPromise((resolve) => {
                expect(command).to.deep.equal(["invoke", "local"]);
                console.log('[0, "flask command output"]'); // eslint-disable-line no-console
                resolve();
              }),
          },
        },
        { command: "check" }
      );

      var sandbox = sinon.createSandbox();
      let loggerSpy = sandbox.spy(mockCli, "log");
      return plugin.hooks["wsgi:flask:local:flask"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.c).to.be.undefined;
        expect(plugin.serverless.pluginManager.cliOptions.context).to.be
          .undefined;
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.options.function).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"flask","data":"check"}}'
        );
        expect(plugin.options.data).to.equal(
          '{"_serverless-wsgi":{"command":"flask","data":"check"}}'
        );
        expect(loggerSpy.calledWith("flask command output")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("invoke local", () => {
    it("installs handler before invocation", () => {
      var functions = {
        app: { handler: "wsgi.handler" },
        other: { handler: "other.handler" },
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: functions,
            getFunction: (name) => functions[name],
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { function: "other" }
      );

      // Test invocation for non-WSGI function, should do nothing
      return expect(
        plugin.hooks["before:invoke:local:invoke"]()
      ).to.be.fulfilled.then(() => {
        plugin.options.function = "app";

        var sandbox = sinon.createSandbox();
        var copyStub = sandbox.stub(fse, "copyAsync");
        var writeStub = sandbox.stub(fse, "writeFileAsync");
        return plugin.hooks["before:invoke:local:invoke"]().then(() => {
          expect(
            copyStub.calledWith(
              path.resolve(__dirname, "wsgi_handler.py"),
              "/tmp/wsgi_handler.py"
            )
          ).to.be.true;
          expect(
            copyStub.calledWith(
              path.resolve(__dirname, "serverless_wsgi.py"),
              "/tmp/serverless_wsgi.py"
            )
          ).to.be.true;
          expect(writeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
          expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({
            app: "api.app",
          });
          sandbox.restore();
        });
      });
    });

    it("cleans up after invocation", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: {
              app: { handler: "wsgi_handler.handler" },
            },
          },
          classes: { Error: Error },
          cli: { log: () => { } },
        },
        { function: "app" }
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      return plugin.hooks["after:invoke:local:invoke"]().then(() => {
        expect(removeStub.calledWith("/tmp/wsgi_handler.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_wsgi.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
        sandbox.restore();
      });
    });
  });
});
