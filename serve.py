#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
This module serves a WSGI application using werkzeug.

Author: Logan Raarup <logan@logan.dk>
"""
import importlib
import os
import sys

try:
    from werkzeug import serving
except ImportError:  # pragma: no cover
    sys.exit('Unable to import werkzeug (run: pip install werkzeug)')


def serve(cwd, app, port):
    sys.path.insert(0, cwd)

    wsgi_fqn = app.rsplit('.', 1)
    wsgi_module = importlib.import_module(wsgi_fqn[0].replace('/', '.'))
    wsgi_app = getattr(wsgi_module, wsgi_fqn[1])

    # Attempt to force Flask into debug mode
    try:
        wsgi_app.debug = True
    except:
        pass

    serving.run_simple(
        'localhost', int(port), wsgi_app,
        use_debugger=True, use_reloader=True, use_evalex=True)


if __name__ == '__main__':  # pragma: no cover
    if len(sys.argv) != 4:
        sys.exit('Usage: {} CWD APP PORT'.format(
            os.path.basename(sys.argv[0])))

    serve(*sys.argv[1:])
