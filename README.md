# Serverless WSGI

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/logandk/serverless-wsgi.png?branch=master)](https://travis-ci.org/logandk/serverless-wsgi)
[![Coverage Status](https://coveralls.io/repos/github/logandk/serverless-wsgi/badge.svg?branch=master)](https://coveralls.io/github/logandk/serverless-wsgi?branch=master)
[![Dependency Status](https://david-dm.org/logandk/serverless-wsgi.png)](https://david-dm.org/logandk/serverless-wsgi)
[![Dev Dependency Status](https://david-dm.org/logandk/serverless-wsgi/dev-status.png)](https://david-dm.org/logandk/serverless-wsgi#info=devDependencies&view=table)

A Serverless v1.3 plugin to build your deploy Python WSGI applications using Serverless. Compatible
WSGI application frameworks include Flask, Django and Pyramid - for a complete list, see:
[http://wsgi.readthedocs.io/en/latest/frameworks.html](http://wsgi.readthedocs.io/en/latest/frameworks.html).

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
      - http: ANY {proxy+}

custom:
  wsgi:
    app: api.app
```


### requirements.txt

Add Flask to the application bundle.

```
Flask==0.11.1
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
* Django is configured for WSGI by default, set the callable to `<project_name>.wsgi.application`. See [https://docs.djangoproject.com/en/1.10/howto/deployment/wsgi/](https://docs.djangoproject.com/en/1.10/howto/deployment/wsgi/) for more information.


## Usage

### Automatic requirement packaging

You'll need to include any packages that your application uses in the bundle
that's deployed to AWS Lambda. This plugin helps you out by doing this automatically,
as long as you specify your required packages in a `requirements.txt` file in the root
of your Serverless service path:

```
Flask==0.11.1
requests==2.11.1
```

For more information, see [https://pip.readthedocs.io/en/1.1/requirements.html](https://pip.readthedocs.io/en/1.1/requirements.html).

You can use the requirement packaging functionality of *serverless-wsgi* without the WSGI
handler itself by including the plugin in your `serverless.yml` configuration, without specifying
the `custom.wsgi.app` setting. This will omit the WSGI handler from the package, but include
any requirements specified in `requirements.txt`.

If you do not include the WSGI handler, you'll need to add `.requirements` to the Python search path
manually in your handler, before importing any packages:

```
import os
import sys
root = os.path.abspath(os.path.join(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(root, '.requirements'))
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
