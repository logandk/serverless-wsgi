# 1.4.8

## Bugs

* Set correct SCRIPT_NAME in `amazonaws.com.*` AWS regions

  _Winton Wang_

# 1.4.7

## Features

* Gracefully handle scheduled events and invocations from serverless-plugin-warmup (#54)

  _Chao Xie_

* Enable zip dependencies when using the serverless-python-requirements plugin (#56)

  _Eric Magalhães_

# Bugs

* Skip setting CloudFormation-interpreted environment variables during local serving (#53)
* Include `application/javascript` as a plain text MIME type (#55)

# 1.4.6

## Bugs

* Skip WSGI encoding dance for request body to avoid garbling UTF-8 characters

  _Shintaro Tanaka_

# 1.4.5

## Features

* Ignore `*.dist-info` and `*.pyc` when packaging requirements
* Remove `.requirements` prior to packaging to avoid deploying packages
  that are no longer required

# 1.4.4

## Features

* Make binding host configurable when invoking `sls wsgi serve`

  _Eric Magalhães_

* Add `application/vnd.api+json` to list of non-binary MIME types

  _Marshal Newrock_

# 1.4.3

## Bugs

* Fix double conversion issue for binary payloads

  _Alex DeBrie_

# 1.4.2

## Bugs

* Fix calculation of content length for binary payloads on Python 3
* WSGI error stream was output to stdout instead of stderr

# 1.4.1

## Features

* Add IS_OFFLINE environment variable to serve (#42).

  _Alex DeBrie_

* Handle binary request payloads and compressed responses (#41).

  _Malcolm Jones_

* Provide access to raw `event` through request environment (#37).

## Bugs

* Fixed issue where CONTENT_LENGTH was computed differently than the wsgi.input (#40).

  _Phil Hachey_

* Fix deprecation warnings for the before:deploy:createDeploymentArtifacts and after:deploy:createDeploymentArtifacts hooks (#43).

  _Malcolm Jones_

* Blacklist `__pycache__` from requirements packaging in order to avoid conflicts (#35).
* Fix insecure usage of X-Forwarded-For (#36).
* Explicitly set virtualenv interpreter when packaging requirements (#34).

# 1.4.0

## Features

* Package requirements into service root directory in order to avoid munging
  sys.path to load requirements (#30).
* Package requirements when deploying individual non-WSGI functions (#30).
* Added `pythonBin` option to set python executable, defaulting to current runtime version (#29).

# 1.3.1

## Features

* Add configuration for handling base path mappings (API_GATEWAY_BASE_PATH)

  _Alex DeBrie_

## Bugs

* Only add .requirements folder to includes when packing enabled

  _Darcy Rayner_

# 1.3.0

## Features

* Load subdirectory packages by adding the subdirectory to the search path (i.e. setting the wsgi handler to something like `dir/api.app.handler`).

  Previously, the subdirectory was expected to be a package (i.e. containing `__init__.py`)

## Bugs

* Skip removing `.requirements` if `packRequirements: false`

  _Alex DeBrie_

* Supply wsgi.input as BytesIO on Python 3

  _Brett Higgins_

# 1.2.2

## Features

* Add default package includes for `.wsgi_app` and `.requirements`

## Bugs

* Fix requirement packaging on Mac OS with Python 3.6 (Anaconda)

  _Vitaly Davydov_

# 1.2.1

## Features

* Support base64 encoding of binary responses automatically based on MIME type

  _Andre de Cavaignac_

## Bugs

* Properly handle Python 3 bytestring response

  _Andre de Cavaignac_

# 1.2.0

## Features

* Python 3 support

# 1.1.1

## Features

* Pass Lambda context in the `context` property of the WSGI environment.

  _Lucas Costa_

# 1.1.0

## Features

* Support for multiple Set-Cookie headers (#11). _Thanks to Ben Bangert for creating an issue and providing an implementation._

* Forward API Gateway authorizer information as API_GATEWAY_AUTHORIZER in the WSGI request environment (#7). _Thanks to Greg Zapp for reporting._

# 1.0.4

## Features

* Optional requirement packaging: Skips requirement packaging if `custom.wsgi.packRequirements` is set to false

  _Lucas Costa_

* Adds support for packaging requirements when wsgi app is in a subdirectory (i.e. setting the wsgi handler to something like `dir/app.handler`).

  _Lucas Costa_

* Package WSGI handler and requirements on single-function deployment

  _Lucas Costa_

# 1.0.3

## Features

* Adds support for packaging handlers inside directories (i.e. setting the wsgi handler to something like `dir/app.handler`).

  _Lucas Costa_

# 1.0.2

## Features

* Added unit tests.

## Bugs

* Internal requirements file was not included when user requirements file was present.

# 1.0.1

## Features

* Enable using the requirements packaging functionality alone, without the WSGI handler. This is enabled by omitting the `custom.wsgi.app` setting from `serverless.yml`.
* Load provider and function environment variables when serving WSGI app locally.

## Bugs

* If no `requirements.txt` file is present and the WSGI handler is enabled, make sure to package werkzeug.
