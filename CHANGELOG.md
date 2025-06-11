# 3.1.0

## Bugs

- Fix missing CloudWatch log messages for errors occurring during app start-up

  _Kieren Eaton_

# 3.0.5

## Security

- Remove hasbin dependency

## Features

- Add ability to provide function to execute when calling sls wsgi command

  _ayaan-qadri_

# 3.0.4

## Bugs

- Fix lambda response processing

  _Eric Petway_

# 3.0.3

## Features

- As of Werkzeug 3.0.0, url_encode is no longer available, use the urllib counterparts

  _Ryan Whittaker_

# 3.0.2

## Features

- Support base path stripping for v2 events
- Default to https when protocol not specified in event
- Add blacklist entries

  _arsoni20_

## Bugs

- Fix handling of v1 event payload emitted by Serverless Offline plugin
- Handle event with None body emitted by Serverless Offline plugin
- Fixes for Scaleway

  _Andrej Shadura_

# 3.0.1

## Bugs

- Fix console output on commands/manage

  _Justin Lyons_

# 3.0.0

## Features

- Update serverless integration for v3 compatibility (breaks integration with serverless < 2.32.0) (#193)

  _Mariusz Nowak_

- Add options for specifying SSL cert location when serving locally (#195)

  _Nathaniel J. Padgett_

- Support wsgi handler placed in a subfolder (#198)

  _Felipe Passos_

# 2.0.2

## Bugs

- Compatibility upgrade for serverless 2.32 (#189)

  _Justin Lyons_

# 2.0.1

## Bugs

- Lambda integration handler invoked for API Gateway proxy events, caused by #185 (#188)

# 2.0.0

## Features

- Drops Python 2 support and require Werkzeug 2 or later
- Remove deprecated API_GATEWAY_AUTHORIZER, event and context variables from WSGI environment. (Use serverless.authorizer, serverless.event and serverless.context instead)

# 1.7.8

## Bugs

- Pin Werkzeug version (#178)

  _Adam Chelminski_

# 1.7.7

## Features

- Add handler for lambda integration (#167)

  _Jan Varho_

## Bugs

- Fix serverless deprecation warnings (#174)

  _Jan Varho_

# 1.7.6

## Features

- Support for the new HTTP API lambda proxy response payload v2.0 (#149)

  _Ronald Tscherepanow_

## Bugs

- Fix eventContext for KONG gateway (#147)

  _Grant Johnson_

- Fix the ALB query parameter handling (#146)

  _Hsiao-Ting Yu_

# 1.7.5

## Bugs

- Fix integration with virtualenv for latest version (20.x)
- Fix wrong encoding of error messages during packaging (#122, #139)

  _Jan Varho_

# 1.7.4

## Bugs

- Return error exit code when `exec`, `command`, `manage` or `flask` commands fail (#114)
- Display output from failing `command` invocations instead of throwing exception (#107)

# 1.7.3

## Features

- Add `--ssl` flag to `sls wsgi serve` (#103)
- Add log message when skipping handler on warmup events (#95)
- Add options for disabling threading and setting number of processes when invoking `sls wsgi serve` (#100)

  _Bryan Worrell_

- Allow use of CloudFront with a pre-set path (#101)

  _Paul Bowsher_

## Bugs

- Properly decode event `path` into environ `PATH_INFO` (#93)
- Fix local serving when package `individually: true` and function `module` are provided (#98)
- Fix Flask CLI invocation of built-in commands (#99)

  _Mischa Spiegelmock_

# 1.7.2

## Features

- Support multi-value query string parameters (#87)

  _Jan Varho_

- Support multi-value headers in request and response
- Add `sls wsgi flask` and `sls wsgi flask local` commands (#86)

# 1.7.1

## Features

- Add local versions of manage, command and exec commands (#79)
- Support serverless-python-requirements packaging with `individually` and `module` configuration (#85)

# 1.7.0

## Features

- Rename `.wsgi_app` to `.serverless-wsgi` (to follow convention from `serverless-rack`)
- Check for werkzeug presence in bundle or issue warning (#80)

## Bugs

- The `wsgi.handler` has been renamed to `wsgi_handler.handler` due to a naming
  conflict with an internal AWS wsgi module. A warning and workaround is issued in order
  to prevent breaking existing configuration files (#84)

# 1.6.1

## Features

- Use proper namespacing for custom WSGI environment variables: `serverless.authorizer`, `serverless.event` and `serverless.context`.
  Note: `API_GATEWAY_AUTHORIZER`, `event` and `context` will be deprecated later.
- Permute header casings for multiple values of any header, not just `Set-Cookie`

# 1.6.0

## Features

- Add `exec`, `command` and `manage` CLI commands for invoking scripts remotely (#75)
- Detect presence of `serverless-python-requirements` and disable `packRequirements` automatically
- Add `pipArgs` configuration option for passing additional arguments to pip (#76)
- Add support for ALB requests (#77)

  _Alan Trope_

- Improve log output for errors at import-time

  _Jackal_

# 1.5.3

## Features

- Add `sls wsgi install` command to install WSGI handler and requirements for local use
- Support `sls invoke local` (serverless/serverless#5475)

# 1.5.2

## Features

- Add `image/svg+xml` to default text mime types (#74)

## Bugs

- Add missing `werkzeug` requirement to `setup.py` (#73)

# 1.5.1

## Bugs

- Fix import error when using unzip_requirements from serverless-python-requirements (#72)

  _Justin Plock_

# 1.5.0

## Features

- Allow adding additional text mime-types (#68)
- Improve detection of available Python executable and associated error messages (#66)
- Start multithreaded server when running `sls wsgi serve` (#69)
- Publish Python package to PyPI (#63)

## Internal

- Change `.wsgi_app` to contain JSON serialized configuration object

# 1.4.9

## Features

- Add compatibility with serverless-offline (#61)

  _Matthew Hardwick_

## Bugs

- Set `IS_OFFLINE` before importing application when running under `sls wsgi serve` (#65)

# 1.4.8

## Bugs

- Set correct SCRIPT_NAME in `amazonaws.com.*` AWS regions

  _Winton Wang_

# 1.4.7

## Features

- Gracefully handle scheduled events and invocations from serverless-plugin-warmup (#54)

  _Chao Xie_

- Enable zip dependencies when using the serverless-python-requirements plugin (#56)

  _Eric Magalhães_

# Bugs

- Skip setting CloudFormation-interpreted environment variables during local serving (#53)
- Include `application/javascript` as a plain text MIME type (#55)

# 1.4.6

## Bugs

- Skip WSGI encoding dance for request body to avoid garbling UTF-8 characters

  _Shintaro Tanaka_

# 1.4.5

## Features

- Ignore `*.dist-info` and `*.pyc` when packaging requirements
- Remove `.requirements` prior to packaging to avoid deploying packages
  that are no longer required

# 1.4.4

## Features

- Make binding host configurable when invoking `sls wsgi serve`

  _Eric Magalhães_

- Add `application/vnd.api+json` to list of non-binary MIME types

  _Marshal Newrock_

# 1.4.3

## Bugs

- Fix double conversion issue for binary payloads

  _Alex DeBrie_

# 1.4.2

## Bugs

- Fix calculation of content length for binary payloads on Python 3
- WSGI error stream was output to stdout instead of stderr

# 1.4.1

## Features

- Add IS_OFFLINE environment variable to serve (#42).

  _Alex DeBrie_

- Handle binary request payloads and compressed responses (#41).

  _Malcolm Jones_

- Provide access to raw `event` through request environment (#37).

## Bugs

- Fixed issue where CONTENT_LENGTH was computed differently than the wsgi.input (#40).

  _Phil Hachey_

- Fix deprecation warnings for the before:deploy:createDeploymentArtifacts and after:deploy:createDeploymentArtifacts hooks (#43).

  _Malcolm Jones_

- Blacklist `__pycache__` from requirements packaging in order to avoid conflicts (#35).
- Fix insecure usage of X-Forwarded-For (#36).
- Explicitly set virtualenv interpreter when packaging requirements (#34).

# 1.4.0

## Features

- Package requirements into service root directory in order to avoid munging
  sys.path to load requirements (#30).
- Package requirements when deploying individual non-WSGI functions (#30).
- Added `pythonBin` option to set python executable, defaulting to current runtime version (#29).

# 1.3.1

## Features

- Add configuration for handling base path mappings (API_GATEWAY_BASE_PATH)

  _Alex DeBrie_

## Bugs

- Only add .requirements folder to includes when packing enabled

  _Darcy Rayner_

# 1.3.0

## Features

- Load subdirectory packages by adding the subdirectory to the search path (i.e. setting the wsgi handler to something like `dir/api.app.handler`).

  Previously, the subdirectory was expected to be a package (i.e. containing `__init__.py`)

## Bugs

- Skip removing `.requirements` if `packRequirements: false`

  _Alex DeBrie_

- Supply wsgi.input as BytesIO on Python 3

  _Brett Higgins_

# 1.2.2

## Features

- Add default package includes for `.wsgi_app` and `.requirements`

## Bugs

- Fix requirement packaging on Mac OS with Python 3.6 (Anaconda)

  _Vitaly Davydov_

# 1.2.1

## Features

- Support base64 encoding of binary responses automatically based on MIME type

  _Andre de Cavaignac_

## Bugs

- Properly handle Python 3 bytestring response

  _Andre de Cavaignac_

# 1.2.0

## Features

- Python 3 support

# 1.1.1

## Features

- Pass Lambda context in the `context` property of the WSGI environment.

  _Lucas Costa_

# 1.1.0

## Features

- Support for multiple Set-Cookie headers (#11). _Thanks to Ben Bangert for creating an issue and providing an implementation._

- Forward API Gateway authorizer information as API_GATEWAY_AUTHORIZER in the WSGI request environment (#7)

  _Thanks to Greg Zapp for reporting_

# 1.0.4

## Features

- Optional requirement packaging: Skips requirement packaging if `custom.wsgi.packRequirements` is set to false

  _Lucas Costa_

- Adds support for packaging requirements when wsgi app is in a subdirectory (i.e. setting the wsgi handler to something like `dir/app.handler`).

  _Lucas Costa_

- Package WSGI handler and requirements on single-function deployment

  _Lucas Costa_

# 1.0.3

## Features

- Adds support for packaging handlers inside directories (i.e. setting the wsgi handler to something like `dir/app.handler`).

  _Lucas Costa_

# 1.0.2

## Features

- Added unit tests.

## Bugs

- Internal requirements file was not included when user requirements file was present.

# 1.0.1

## Features

- Enable using the requirements packaging functionality alone, without the WSGI handler. This is enabled by omitting the `custom.wsgi.app` setting from `serverless.yml`.
- Load provider and function environment variables when serving WSGI app locally.

## Bugs

- If no `requirements.txt` file is present and the WSGI handler is enabled, make sure to package werkzeug.
