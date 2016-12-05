# 1.0.1
## Features
* Enable using the requirements packaging functionality alone, without the WSGI handler. This is enabled by omitting the `custom.wsgi.app` setting from `serverless.yml`.

## Bugs
* If no `requirements.txt` file is present and the WSGI handler is enabled, make sure to package werkzeug.
