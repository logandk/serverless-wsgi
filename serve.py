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


def serve(cwd, app, port, host='localhost'):
    sys.path.insert(0, cwd)

    wsgi_fqn = app.rsplit('.', 1)
    wsgi_fqn_parts = wsgi_fqn[0].rsplit('/', 1)
    if len(wsgi_fqn_parts) == 2:
        sys.path.insert(0, os.path.join(cwd, wsgi_fqn_parts[0]))
    wsgi_module = importlib.import_module(wsgi_fqn_parts[-1])
    wsgi_app = getattr(wsgi_module, wsgi_fqn[1])

    # Attempt to force Flask into debug mode
    try:
        wsgi_app.debug = True
    except:  # noqa: E722
        pass

    os.environ['IS_OFFLINE'] = 'True'

    serving.run_simple(
        host,
        int(port),
        wsgi_app,
        use_debugger=True,
        use_reloader=True,
        use_evalex=True)


if __name__ == '__main__':  # pragma: no cover
    if len(sys.argv) != 5:
        sys.exit('Usage: {} CWD APP PORT HOST'.format(
            os.path.basename(sys.argv[0])))

    serve(*sys.argv[1:])
