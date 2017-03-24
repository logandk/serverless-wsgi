#!/usr/bin/env python
# -*- coding: utf-8 -*-
import importlib
import serve
import sys
from werkzeug import serving


class ModuleStub:
    pass


def test_serve(monkeypatch):
    def mock_importlib(module):
        app = ModuleStub
        app.app = ModuleStub()
        app.app.module = module
        return app

    calls = []

    def mock_serving(host, port, app, **kwargs):
        calls.append((host, port, app, kwargs))

    monkeypatch.setattr(importlib, 'import_module', mock_importlib)
    monkeypatch.setattr(serving, 'run_simple', mock_serving)

    path = []

    monkeypatch.setattr(sys, 'path', path)

    serve.serve('/tmp1', 'app.app', '5000')
    assert len(path) == 1
    assert path[0] == '/tmp1'
    assert len(calls) == 1
    assert calls[0][0] == 'localhost'
    assert calls[0][1] == 5000
    assert calls[0][2].module == 'app'
    assert calls[0][2].debug
    assert calls[0][3] == {
        'use_reloader': True,
        'use_debugger': True,
        'use_evalex': True
    }

    serve.serve('/tmp2', 'subdir/app.app', '5000')
    assert len(path) == 2
    assert path[0] == '/tmp2'
    assert len(calls) == 2
    assert calls[1][0] == 'localhost'
    assert calls[1][1] == 5000
    assert calls[1][2].module == 'subdir.app'
    assert calls[1][2].debug
    assert calls[1][3] == {
        'use_reloader': True,
        'use_debugger': True,
        'use_evalex': True
    }
