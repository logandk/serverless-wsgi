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
