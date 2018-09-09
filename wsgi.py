#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
This module loads the WSGI application specified by FQN in `.wsgi_app` and invokes
the request when the handler is called by AWS Lambda.

Author: Logan Raarup <logan@logan.dk>
"""
import importlib
import json
import os
import sys

# Call decompression helper from `serverless-python-requirements` if
# available. See: https://github.com/UnitedIncome/serverless-python-requirements#dealing-with-lambdas-size-limitations
try:
    import unzip_requirements  # noqa
except ImportError:
    pass

import serverless_wsgi


def load_config():
    """ Read the configuration file created during deployment
    """
    root = os.path.abspath(os.path.dirname(__file__))
    with open(os.path.join(root, ".wsgi_app"), "r") as f:
        return json.loads(f.read())


def import_app(config):
    """ Load the application WSGI handler
    """
    wsgi_fqn = config["app"].rsplit(".", 1)
    wsgi_fqn_parts = wsgi_fqn[0].rsplit("/", 1)

    if len(wsgi_fqn_parts) == 2:
        root = os.path.abspath(os.path.dirname(__file__))
        sys.path.insert(0, os.path.join(root, wsgi_fqn_parts[0]))

    wsgi_module = importlib.import_module(wsgi_fqn_parts[-1])

    return getattr(wsgi_module, wsgi_fqn[1])


def append_text_mime_types(config):
    """ Append additional text (non-base64) mime types from configuration file
    """
    if "text_mime_types" in config and isinstance(config["text_mime_types"], list):
        serverless_wsgi.TEXT_MIME_TYPES.extend(config["text_mime_types"])


def make_handler(wsgi_app):
    """ Factory that builds a Lambda event handler for a given WSGI application
    """
    return lambda event, context: serverless_wsgi.handle_request(
        wsgi_app, event, context
    )


# Read configuration and import the WSGI application
config = load_config()
wsgi_app = import_app(config)
append_text_mime_types(config)

# Declare the AWS Lambda event handler
handler = make_handler(wsgi_app)
