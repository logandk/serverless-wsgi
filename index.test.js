"use strict";

/* global describe it */
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const Plugin = require("./index");
const child_process = require("child_process");
const path = require("path");
const fse = require("fs-extra");
const hasbin = require("hasbin");
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
            generateCommandsHelp: command => {
              expect(command).to.deep.equal(["wsgi"]);
            }
          }
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
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var procStub = sandbox.stub(child_process, "spawnSync");
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(procStub.called).to.be.false;
        sandbox.restore();
      });
    });

    it("packages wsgi handler", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
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
          app: "api.app"
        });
        expect(
          procStub.calledWith("python2.7", [
            path.resolve(__dirname, "requirements.py"),
            path.resolve(__dirname, "requirements.txt"),
            "/tmp/.requirements"
          ])
        ).to.be.true;
        sandbox.restore();
        expect(plugin.serverless.service.package.include).to.have.members([
          "wsgi_handler.py",
          "serverless_wsgi.py",
          ".serverless-wsgi"
        ]);
        expect(plugin.serverless.service.package.exclude).to.have.members([
          ".requirements/**"
        ]);
      });
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
                textMimeTypes: ["application/custom+json"]
              }
            }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(child_process, "spawnSync").returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(writeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
        expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({
          app: "api.app",
          text_mime_types: ["application/custom+json"]
        });
        sandbox.restore();
      });
    });

    it("falls back to default python if runtime version is not found", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python3.6" },
            custom: {
              wsgi: {
                app: "api.app"
              }
            }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(false);
      sandbox.stub(fse, "copyAsync");
      sandbox.stub(fse, "writeFileAsync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.calledWith("python3.6")).to.be.true;
        expect(
          procStub.calledWith("python", [
            path.resolve(__dirname, "requirements.py"),
            path.resolve(__dirname, "requirements.txt"),
            "/tmp/.requirements"
          ])
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("cleans up after deployment", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      plugin.hooks["after:package:createDeploymentArtifacts"]().then(() => {
        expect(removeStub.calledWith("/tmp/wsgi_handler.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_wsgi.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
        expect(removeStub.calledWith("/tmp/.requirements")).to.be.false;
        sandbox.restore();
      });
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
            package: { include: ["sample.txt"] }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var symlinkStub = sandbox.stub(fse, "symlinkSync");
      sandbox.stub(fse, "readdirSync").returns(["flask", "werkzeug"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(symlinkStub.called).to.be.true;
        expect(
          procStub.calledWith("python2.7", [
            path.resolve(__dirname, "requirements.py"),
            path.resolve(__dirname, "requirements.txt"),
            "/tmp/requirements.txt",
            "/tmp/.requirements"
          ])
        ).to.be.true;
        expect(plugin.serverless.service.package.include).to.have.members([
          "sample.txt",
          "wsgi_handler.py",
          "serverless_wsgi.py",
          ".serverless-wsgi",
          "flask",
          "flask/**",
          "werkzeug",
          "werkzeug/**"
        ]);
        expect(plugin.serverless.service.package.exclude).to.have.members([
          ".requirements/**"
        ]);
        sandbox.restore();
      });
    });

    it("allows setting the python binary", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app", pythonBin: "my-python" } },
            package: { include: ["sample.txt"] }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var symlinkStub = sandbox.stub(fse, "symlinkSync");
      sandbox.stub(fse, "readdirSync").returns(["flask"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.called).to.be.false;
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(symlinkStub.called).to.be.true;
        expect(
          procStub.calledWith("my-python", [
            path.resolve(__dirname, "requirements.py"),
            path.resolve(__dirname, "requirements.txt"),
            "/tmp/requirements.txt",
            "/tmp/.requirements"
          ])
        ).to.be.true;
        expect(plugin.serverless.service.package.include).to.have.members([
          "sample.txt",
          "wsgi_handler.py",
          "serverless_wsgi.py",
          ".serverless-wsgi",
          "flask",
          "flask/**"
        ]);
        expect(plugin.serverless.service.package.exclude).to.have.members([
          ".requirements/**"
        ]);
        sandbox.restore();
      });
    });

    it("packages user requirements for wsgi app inside directory", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: {},
            custom: { wsgi: { app: "api/api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "readdirSync").returns([]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(
          procStub.calledWith("python", [
            path.resolve(__dirname, "requirements.py"),
            path.resolve(__dirname, "requirements.txt"),
            "/tmp/api/requirements.txt",
            "/tmp/api/.requirements"
          ])
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("throws an error when a file already exists in the service root", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(hasbin, "sync").returns(true);
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
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(hasbin, "sync").returns(true);
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
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "symlinkSync").throws();
      sandbox.stub(fse, "readlinkSync").returns("/tmp/.requirements/flask");
      sandbox.stub(fse, "readdirSync").returns(["flask"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(
          procStub.calledWith("python2.7", [
            path.resolve(__dirname, "requirements.py"),
            "/tmp/requirements.txt",
            "/tmp/.requirements"
          ])
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("packages user requirements with additional pip args", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python3.6" },
            custom: { wsgi: { pipArgs: "--no-deps 'imaginary \"value\"'" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "symlinkSync").throws();
      sandbox.stub(fse, "readlinkSync").returns("/tmp/.requirements/flask");
      sandbox.stub(fse, "readdirSync").returns(["flask"]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.calledWith("python3.6")).to.be.true;
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(
          procStub.calledWith("python3.6", [
            path.resolve(__dirname, "requirements.py"),
            "--pip-args",
            "--no-deps 'imaginary \"value\"'",
            "/tmp/requirements.txt",
            "/tmp/.requirements"
          ])
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("skips packaging for non-wsgi app without user requirements", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "existsSync").returns(false);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(procStub.called).to.be.false;
        expect(plugin.serverless.service.package.exclude).to.have.members([
          ".requirements/**"
        ]);
        sandbox.restore();
      });
    });

    it("rejects with non successful exit code", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "python2.7" } },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(hasbin, "sync").returns(true);
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
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(hasbin, "sync").returns(true);
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
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(hasbin, "sync").returns(true);
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
            custom: { wsgi: { app: "api.app", packRequirements: false } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(existsStub.called).to.be.false;
        expect(procStub.called).to.be.false;
        expect(plugin.serverless.service.package.include).not.to.have.members([
          ".requirements/**"
        ]);
        sandbox.restore();
      });
    });

    it("skips requirements cleanup if disabled", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app", packRequirements: false } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      plugin.hooks["after:package:createDeploymentArtifacts"]().then(() => {
        expect(removeStub.calledWith("/tmp/wsgi_handler.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_wsgi.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
        expect(removeStub.calledWith("/tmp/.requirements")).to.be.false;
        sandbox.restore();
      });
    });

    it("skips packaging if serverless-python-requirements is present", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            plugins: ["serverless-wsgi", "serverless-python-requirements"]
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(existsStub.called).to.be.false;
        expect(procStub.called).to.be.false;
        expect(plugin.serverless.service.package.include).not.to.have.members([
          ".requirements/**"
        ]);
        sandbox.restore();
      });
    });
  });

  describe("function deployment", () => {
    it("skips packaging for non-wsgi function", () => {
      var functions = {
        app: {}
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: functions
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:deploy:function:packageFunction"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(procStub.called).to.be.true;
        sandbox.restore();
      });
    });

    it("packages wsgi handler", () => {
      var functions = {
        app: { handler: "wsgi_handler.handler" }
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: functions
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "readdirSync").returns([]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:deploy:function:packageFunction"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
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
          app: "api.app"
        });
        expect(
          procStub.calledWith("python2.7", [
            path.resolve(__dirname, "requirements.py"),
            path.resolve(__dirname, "requirements.txt"),
            "/tmp/requirements.txt",
            "/tmp/.requirements"
          ])
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("cleans up after deployment", () => {
      var functions = {
        app: { handler: "wsgi_handler.handler" }
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: functions
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      var existsStub = sandbox.stub(fse, "existsSync").returns(true);
      existsStub.withArgs("werkzeug").returns(false);
      sandbox.stub(fse, "readdirSync").returns(["flask", "werkzeug"]);
      var unlinkStub = sandbox.stub(fse, "unlinkSync");
      plugin.hooks["after:deploy:function:packageFunction"]().then(() => {
        expect(existsStub.calledWith("/tmp/.requirements")).to.be.true;
        expect(unlinkStub.calledWith("flask")).to.be.true;
        expect(unlinkStub.calledWith("werkzeug")).to.be.false;
        expect(removeStub.calledWith("/tmp/wsgi_handler.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_wsgi.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
        expect(removeStub.calledWith("/tmp/.requirements")).to.be.false;
        sandbox.restore();
      });
    });
  });

  describe("serve", () => {
    it("fails for non-wsgi app", () => {
      var plugin = new Plugin({
        config: { servicePath: "/tmp" },
        service: { provider: { runtime: "python2.7" } },
        classes: { Error: Error },
        cli: { log: () => {} }
      });

      return expect(plugin.hooks["wsgi:serve:serve"]()).to.be.rejected;
    });

    it("executes python wrapper", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "localhost"
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
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ error: "Something failed" });
      expect(
        plugin.hooks["wsgi:serve:serve"]()
      ).to.eventually.be.rejected.and.notify(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "localhost"
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
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ error: { code: "ENOENT" } });
      expect(
        plugin.hooks["wsgi:serve:serve"]()
      ).to.eventually.be.rejected.and.notify(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "localhost"
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
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { port: 8000 }
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              8000,
              "localhost"
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
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { host: "0.0.0.0" }
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
        expect(
          procStub.calledWith(
            "python2.7",
            [
              path.resolve(__dirname, "serve.py"),
              "/tmp",
              "api.app",
              5000,
              "0.0.0.0"
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
                ANOTHER_ONE: { Ref: "AWS::StackId" }
              }
            },
            functions: {
              func1: {
                handler: "wsgi_handler.handler",
                environment: { SECOND_VAR: 33 }
              },
              func2: { handler: "x.x", environment: { THIRD_VAR: 66 } },
              func3: { handler: "wsgi_handler.handler" }
            },
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { port: 8000 }
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(hasbin, "sync").returns(true);
      sandbox.stub(child_process, "spawnSync").returns({});
      sandbox.stub(process, "env").value({});
      plugin.hooks["wsgi:serve:serve"]().then(() => {
        expect(process.env.SOME_ENV_VAR).to.equal(42);
        expect(process.env.SECOND_VAR).to.equal(33);
        expect(process.env.THIRD_VAR).to.be.undefined;
        expect(process.env.ANOTHER_ONE).to.be.undefined;
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
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var hasbinStub = sandbox.stub(hasbin, "sync").returns(true);
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "readdirSync").returns([]);
      sandbox.stub(fse, "existsSync").returns(true);
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["wsgi:install:install"]().then(() => {
        expect(hasbinStub.calledWith("python2.7")).to.be.true;
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
          app: "api.app"
        });
        expect(
          procStub.calledWith("python2.7", [
            path.resolve(__dirname, "requirements.py"),
            path.resolve(__dirname, "requirements.txt"),
            "/tmp/requirements.txt",
            "/tmp/.requirements"
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
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      var existsStub = sandbox.stub(fse, "existsSync").returns(true);
      sandbox.stub(fse, "readdirSync").returns(["flask"]);
      var unlinkStub = sandbox.stub(fse, "unlinkSync");
      plugin.hooks["wsgi:clean:clean"]().then(() => {
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
        app: { handler: "wsgi_handler.handler" }
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app", packRequirements: false } },
            functions: functions
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      var existsStub = sandbox.stub(fse, "existsSync").returns(true);
      plugin.hooks["wsgi:clean:clean"]().then(() => {
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
    it("fails when invoked without command or file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
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
            functions: { app: { handler: "wsgi_handler.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} },
          pluginManager: {
            cliOptions: {},
            run: command =>
              new BbPromise(resolve => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('"5"'); // eslint-disable-line no-console
                resolve();
              })
          }
        },
        { command: "print(1+4)" }
      );

      var sandbox = sinon.createSandbox();
      let consoleSpy = sandbox.spy(console, "log");
      plugin.hooks["wsgi:exec:exec"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.function).to.equal(
          "app"
        );
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.data).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(consoleSpy.calledWith("5")).to.be.true;
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
            functions: { app: { handler: "wsgi_handler.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} },
          pluginManager: {
            cliOptions: {},
            run: command =>
              new BbPromise(resolve => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('{"response": "5"}'); // eslint-disable-line no-console
                resolve();
              })
          }
        },
        { file: "script.py" }
      );

      var sandbox = sinon.createSandbox();
      let consoleSpy = sandbox.spy(console, "log");
      sandbox.stub(fse, "readFileSync").returns("print(1+4)");
      plugin.hooks["wsgi:exec:exec"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.function).to.equal(
          "app"
        );
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.data).to.equal(
          '{"_serverless-wsgi":{"command":"exec","data":"print(1+4)"}}'
        );
        expect(consoleSpy.calledWith('{"response": "5"}')).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("command", () => {
    it("fails when no wsgi handler is set", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "other.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { command: "pwd" }
      );

      expect(plugin.hooks["wsgi:command:command"]()).to.be.rejectedWith(
        "No functions were found with handler: wsgi_handler.handler"
      );
    });

    it("fails when invoked without command or file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      expect(plugin.hooks["wsgi:command:command"]()).to.be.rejectedWith(
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
            functions: { app: { handler: "wsgi_handler.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} },
          pluginManager: {
            cliOptions: {},
            run: command =>
              new BbPromise(resolve => {
                expect(command).to.deep.equal(["invoke"]);
                console.log("non-json output"); // eslint-disable-line no-console
                resolve();
              })
          }
        },
        { command: "pwd" }
      );

      var sandbox = sinon.createSandbox();
      let consoleSpy = sandbox.spy(console, "log");
      plugin.hooks["wsgi:command:command"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.function).to.equal(
          "app"
        );
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.data).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(consoleSpy.calledWith("non-json output")).to.be.true;
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
            functions: { app: { handler: "wsgi_handler.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} },
          pluginManager: {
            cliOptions: {},
            run: command =>
              new BbPromise(resolve => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('"/var/task"'); // eslint-disable-line no-console
                resolve();
              })
          }
        },
        { file: "script.sh" }
      );

      var sandbox = sinon.createSandbox();
      let consoleSpy = sandbox.spy(console, "log");
      sandbox.stub(fse, "readFileSync").returns("pwd");
      plugin.hooks["wsgi:command:command"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.function).to.equal(
          "app"
        );
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.data).to.equal(
          '{"_serverless-wsgi":{"command":"command","data":"pwd"}}'
        );
        expect(consoleSpy.calledWith("/var/task")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("manage", () => {
    it("calls handler to execute manage commands remotely from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: { app: { handler: "wsgi_handler.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} },
          pluginManager: {
            cliOptions: {},
            run: command =>
              new BbPromise(resolve => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('"manage command output"'); // eslint-disable-line no-console
                resolve();
              })
          }
        },
        { command: "check" }
      );

      var sandbox = sinon.createSandbox();
      let consoleSpy = sandbox.spy(console, "log");
      plugin.hooks["wsgi:manage:manage"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.function).to.equal(
          "app"
        );
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-wsgi":{"command":"manage","data":"check"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.data).to.equal(
          '{"_serverless-wsgi":{"command":"manage","data":"check"}}'
        );
        expect(consoleSpy.calledWith("manage command output")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("invoke local", () => {
    it("installs handler before invocation", () => {
      var functions = {
        app: { handler: "wsgi_handler.handler" },
        other: { handler: "other.handler" }
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "python2.7" },
            custom: { wsgi: { app: "api.app" } },
            functions: functions,
            getFunction: name => functions[name]
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { function: "other" }
      );

      // Test invocation for non-WSGI function, should do nothing
      expect(plugin.hooks["before:invoke:local:invoke"]()).to.be.fulfilled;

      plugin.options.function = "app";

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      plugin.hooks["before:invoke:local:invoke"]().then(() => {
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
          app: "api.app"
        });
        sandbox.restore();
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
              app: { handler: "wsgi_handler.handler" }
            }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { function: "app" }
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      plugin.hooks["after:invoke:local:invoke"]().then(() => {
        expect(removeStub.calledWith("/tmp/wsgi_handler.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_wsgi.py")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-wsgi")).to.be.true;
        sandbox.restore();
      });
    });
  });
});
