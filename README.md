# Serverless WSGI

[![npm package](https://nodei.co/npm/serverless-wsgi.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/serverless-wsgi/)

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/logandk/serverless-wsgi.png?branch=master)](https://travis-ci.org/logandk/serverless-wsgi)
[![Coverage Status](https://coveralls.io/repos/github/logandk/serverless-wsgi/badge.svg?branch=master)](https://coveralls.io/github/logandk/serverless-wsgi?branch=master)
[![Dependency Status](https://david-dm.org/logandk/serverless-wsgi.png)](https://david-dm.org/logandk/serverless-wsgi)
[![Dev Dependency Status](https://david-dm.org/logandk/serverless-wsgi/dev-status.png)](https://david-dm.org/logandk/serverless-wsgi?type=dev)

A Serverless v1.x plugin to build your deploy Python WSGI applications using Serverless. Compatible
WSGI application frameworks include Flask, Django and Pyramid - for a complete list, see:
http://wsgi.readthedocs.io/en/latest/frameworks.html.

### Features

* Transparently converts API Gateway requests to and from standard WSGI requests
* Supports anything you'd expect from WSGI such as redirects, cookies, file uploads etc.
* Automatically downloads Python packages that you specify in `requirements.txt` and deploys them along with your application
* Convenient `wsgi serve` command for serving your application locally during development

## Install

```
npm install --save serverless-wsgi
```

Add the plugin to your `serverless.yml` file and set the WSGI application:

```yaml
plugins:
  - serverless-wsgi
```

## Flask configuration example

This example assumes that you have intialized your application as `app` inside `api.py`.

```
project
├── api.py
├── requirements.txt
└── serverless.yml
```

### api.py

A regular Flask application.

```python
from flask import Flask
app = Flask(__name__)


@app.route("/cats")
def cats():
    return "Cats"


@app.route("/dogs/<id>")
def dog(id):
    return "Dog"
```

### serverless.yml

Load the plugin and set the `custom.wsgi.app` configuration in `serverless.yml` to the
module path of your Flask application.

All functions that will use WSGI need to have `wsgi.handler` set as the Lambda handler and
use the default `lambda-proxy` integration for API Gateway. This configuration example treats
API Gateway as a transparent proxy, passing all requests directly to your Flask application,
and letting the application handle errors, 404s etc.

```yaml
service: example

provider:
  name: aws
  runtime: python2.7

plugins:
  - serverless-wsgi

functions:
  api:
    handler: wsgi.handler
    events:
      - http: ANY /
      - http: ANY {proxy+}

custom:
  wsgi:
    app: api.app
```

### requirements.txt

Add Flask to the application bundle.

```
Flask==0.12.2
```

## Deployment

Simply run the serverless deploy command as usual:

```
$ sls deploy
Serverless: Packaging Python WSGI handler...
Serverless: Packaging required Python packages...
Serverless: Packaging service...
Serverless: Removing old service versions...
Serverless: Uploading CloudFormation file to S3...
Serverless: Uploading service .zip file to S3...
Serverless: Updating Stack...
Serverless: Checking Stack update progress...
..........
Serverless: Stack update finished...
```

## Other frameworks

Set `custom.wsgi.app` in `serverless.yml` according to your WSGI callable:

* For Pyramid, use [make_wsgi_app](http://docs.pylonsproject.org/projects/pyramid/en/latest/api/config.html#pyramid.config.Configurator.make_wsgi_app) to intialize the callable
* Django is configured for WSGI by default, set the callable to `<project_name>.wsgi.application`. See https://docs.djangoproject.com/en/1.10/howto/deployment/wsgi/ for more information.

## Usage

### Automatic requirement packaging

You'll need to include any packages that your application uses in the bundle
that's deployed to AWS Lambda. This plugin helps you out by doing this automatically,
as long as you specify your required packages in a `requirements.txt` file in the root
of your Serverless service path:

```
Flask==0.12.2
requests==2.18.3
```

For more information, see https://pip.readthedocs.io/en/1.1/requirements.html.

You can use the requirement packaging functionality of _serverless-wsgi_ without the WSGI
handler itself by including the plugin in your `serverless.yml` configuration, without specifying
the `custom.wsgi.app` setting. This will omit the WSGI handler from the package, but include
any requirements specified in `requirements.txt`.

If you don't want to use automatic requirement packaging you can set `custom.wsgi.packRequirements` to false:

```yaml
custom:
  wsgi:
    app: api.app
    packRequirements: false
```

For a more advanced approach to packaging requirements, consider using https://github.com/UnitedIncome/serverless-python-requirements.

### Python version

Python is used for packaging requirements and serving the app when invoking `sls wsgi serve`. By
default, the current runtime setting is expected to be the name of the Python binary in `PATH`,
for instance `python3.6`. If this is not the name of your Python binary, override it using the
`pythonBin` option:

```yaml
custom:
  wsgi:
    app: api.app
    pythonBin: python3
```

### Local server

For convenience, a `sls wsgi serve` command is provided to run your WSGI application
locally. This command requires the `werkzeug` Python package to be installed,
and acts as a simple wrapper for starting werkzeug's built-in HTTP server.

By default, the server will start on port 5000.

```
$ sls wsgi serve
 * Running on http://localhost:5000/ (Press CTRL+C to quit)
 * Restarting with stat
 * Debugger is active!
```

Configure the port using the `-p` parameter:

```
$ sls wsgi serve -p 8000
 * Running on http://localhost:8000/ (Press CTRL+C to quit)
 * Restarting with stat
 * Debugger is active!
```

### Explicit routes

If you'd like to be explicit about which routes and HTTP methods should pass through to your
application, see the following example:

```yaml
service: example

provider:
  name: aws
  runtime: python2.7

plugins:
  - serverless-wsgi

functions:
  api:
    handler: wsgi.handler
    events:
      - http:
          path: cats
          method: get
          integration: lambda-proxy
      - http:
          path: dogs/{id}
          method: get
          integration: lambda-proxy

custom:
  wsgi:
    app: api.app
```

### Custom domain names

If you use custom domain names with API Gateway, you might have a base path that is
at the beginning of your path, such as the stage (`/dev`, `/stage`, `/prod`). You
can pass in an `API_GATEWAY_BASE_PATH` environment variable so your WSGI app can
handle it correctly.

The example below uses the [serverless-domain-manager](https://github.com/amplify-education/serverless-domain-manager)
plugin to handle custom domains in API Gateway:

```yaml
service: example

provider:
  name: aws
  runtime: python2.7
  environment:
    API_GATEWAY_BASE_PATH: ${self:custom.customDomain.basePath}

plugins:
  - serverless-wsgi
  - serverless-domain-manager

functions:
  api:
    handler: wsgi.handler
    events:
      - http: ANY /
      - http: ANY {proxy+}

custom:
  wsgi:
    app: api.app
  customDomain:
    basePath: ${opt:stage}
    domainName: mydomain.name.com
    stage: ${opt:stage}
    createRoute53Record: true
```

### File uploads

In order to accept file uploads from HTML forms, make sure to add `multipart/form-data` to
the list of content types with _Binary Support_ in your API Gateway API. The
[serverless-apigw-binary](https://github.com/maciejtreder/serverless-apigw-binary)
Serverless plugin can be used to automate this process.

Keep in mind that, when building Serverless applications, uploading
[directly to S3](http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingHTTPPOST.html)
from the browser is usually the preferred approach.

### Raw context and event

The raw context and event from AWS Lambda are both accessible through the WSGI
request. The following example shows how to access them when using Flask:

```python
from flask import Flask, request
app = Flask(__name__)


@app.route("/")
def index():
    print(request.environ['context'])
    print(request.environ['event'])
```

# Thanks

Thanks to [Zappa](https://github.com/Miserlou/Zappa), which has been both the
inspiration and source of several implementations that went into this project.

Thanks to [chalice](https://github.com/awslabs/chalice) for the
requirement packaging implementation.
