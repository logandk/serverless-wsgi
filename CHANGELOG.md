# 1.0.4
## Features
* Optional requirement packaging: Skips requirement packaging if `custom.wsgi.packRequirements` is set to false

  *Lucas Costa*

* Adds support for packaging requirements when wsgi app is in a subdirectory (i.e. setting the wsgi handler to something like `dir/app.handler`).

  *Lucas Costa*

* Package WSGI handler and requirements on single-function deployment

  *Lucas Costa*


# 1.0.3
## Features
* Adds support for packaging handlers inside directories (i.e. setting the wsgi handler to something like `dir/app.handler`).

  *Lucas Costa*


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
