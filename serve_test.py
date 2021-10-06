#!/usr/bin/env python
# -*- coding: utf-8 -*-
import importlib
import pytest
import serve
import sys
import os
from werkzeug import serving


class ObjectStub:
    def __init__(self, **kwds):
        self.__dict__.update(kwds)


@pytest.fixture
def mock_werkzeug(monkeypatch):
    stub = ObjectStub(lastcall=None)

    def mock_serving(host, port, app, **kwargs):
        stub.lastcall = ObjectStub(host=host, port=port, app=app, kwargs=kwargs)

    monkeypatch.setattr(serving, "run_simple", mock_serving)

    return stub


@pytest.fixture
def mock_importlib(monkeypatch):
    app = ObjectStub()
    app.app = ObjectStub()

    def mock_import_module(module):
        if app.app:
            app.app.module = module
        return app

    monkeypatch.setattr(importlib, "import_module", mock_import_module)

    return app


@pytest.fixture
def mock_path(monkeypatch):
    path = []
    monkeypatch.setattr(sys, "path", path)
    return path


@pytest.fixture
def mock_os_path_exists(monkeypatch):
    mock_path = ObjectStub()
    mock_path.file_names_that_exist = []

    def mock_exists(file_name):
        return file_name in mock_path.file_names_that_exist

    monkeypatch.setattr(os.path, 'exists', mock_exists)

    return mock_path


def test_serve(mock_path, mock_importlib, mock_werkzeug):
    serve.serve("/tmp1", "app.app", "5000")
    assert len(mock_path) == 1
    assert mock_path[0] == "/tmp1"
    assert mock_werkzeug.lastcall.host == "localhost"
    assert mock_werkzeug.lastcall.port == 5000
    assert mock_werkzeug.lastcall.app.module == "app"
    assert mock_werkzeug.lastcall.app.debug
    assert mock_werkzeug.lastcall.kwargs == {
        "use_reloader": True,
        "use_debugger": True,
        "use_evalex": True,
        "threaded": True,
        "processes": 1,
        "ssl_context": None,
    }


def test_serve_alternative_hostname(mock_path, mock_importlib, mock_werkzeug):
    serve.serve("/tmp1", "app.app", "5000", "0.0.0.0")
    assert len(mock_path) == 1
    assert mock_path[0] == "/tmp1"
    assert mock_werkzeug.lastcall.host == "0.0.0.0"
    assert mock_werkzeug.lastcall.port == 5000
    assert mock_werkzeug.lastcall.app.module == "app"
    assert mock_werkzeug.lastcall.app.debug
    assert mock_werkzeug.lastcall.kwargs == {
        "use_reloader": True,
        "use_debugger": True,
        "use_evalex": True,
        "threaded": True,
        "processes": 1,
        "ssl_context": None,
    }


def test_serve_disable_threading(mock_path, mock_importlib, mock_werkzeug):
    serve.serve("/tmp1", "app.app", "5000", "0.0.0.0", threaded=False)
    assert len(mock_path) == 1
    assert mock_path[0] == "/tmp1"
    assert mock_werkzeug.lastcall.host == "0.0.0.0"
    assert mock_werkzeug.lastcall.port == 5000
    assert mock_werkzeug.lastcall.app.module == "app"
    assert mock_werkzeug.lastcall.app.debug
    assert mock_werkzeug.lastcall.kwargs == {
        "use_reloader": True,
        "use_debugger": True,
        "use_evalex": True,
        "threaded": False,
        "processes": 1,
        "ssl_context": None,
    }


def test_serve_multiple_processes(mock_path, mock_importlib, mock_werkzeug):
    serve.serve("/tmp1", "app.app", "5000", "0.0.0.0", processes=10)
    assert len(mock_path) == 1
    assert mock_path[0] == "/tmp1"
    assert mock_werkzeug.lastcall.host == "0.0.0.0"
    assert mock_werkzeug.lastcall.port == 5000
    assert mock_werkzeug.lastcall.app.module == "app"
    assert mock_werkzeug.lastcall.app.debug
    assert mock_werkzeug.lastcall.kwargs == {
        "use_reloader": True,
        "use_debugger": True,
        "use_evalex": True,
        "threaded": True,
        "processes": 10,
        "ssl_context": None,
    }


def test_serve_ssl(mock_path, mock_importlib, mock_werkzeug):
    serve.serve("/tmp1", "app.app", "5000", "0.0.0.0", threaded=False, ssl=True)
    assert len(mock_path) == 1
    assert mock_path[0] == "/tmp1"
    assert mock_werkzeug.lastcall.host == "0.0.0.0"
    assert mock_werkzeug.lastcall.port == 5000
    assert mock_werkzeug.lastcall.app.module == "app"
    assert mock_werkzeug.lastcall.app.debug
    assert mock_werkzeug.lastcall.kwargs == {
        "use_reloader": True,
        "use_debugger": True,
        "use_evalex": True,
        "threaded": False,
        "processes": 1,
        "ssl_context": "adhoc",
    }


def test_serve_from_subdir(mock_path, mock_importlib, mock_werkzeug):
    serve.serve("/tmp2", "subdir/app.app", "5000")
    assert len(mock_path) == 2
    assert mock_path[0] == "/tmp2/subdir"
    assert mock_path[1] == "/tmp2"
    assert mock_werkzeug.lastcall.host == "localhost"
    assert mock_werkzeug.lastcall.port == 5000
    assert mock_werkzeug.lastcall.app.module == "app"
    assert mock_werkzeug.lastcall.app.debug
    assert mock_werkzeug.lastcall.kwargs == {
        "use_reloader": True,
        "use_debugger": True,
        "use_evalex": True,
        "threaded": True,
        "processes": 1,
        "ssl_context": None,
    }


def test_serve_non_debuggable_app(mock_path, mock_importlib, mock_werkzeug):
    mock_importlib.app = None

    serve.serve("/tmp1", "app.app", "5000")
    assert mock_werkzeug.lastcall.app is None


def test_validate_ssl_keys_with_no_keys_passed():
    return_value = serve._validate_ssl_keys(None, None)
    assert return_value is None


def test_validate_ssl_keys_with_sys_exit_for_missing_key():
    with pytest.raises(SystemExit) as pytest_wrapped_e:
        serve._validate_ssl_keys('test.pem', None)

    assert pytest_wrapped_e.type == SystemExit
    assert pytest_wrapped_e.value.code == "Missing either cert file or private key file (hint: --ssl-pub <file> and --ssl-pri <file>)"


def test_validate_ssl_keys_with_non_existant_cert_file(mock_os_path_exists):
    with pytest.raises(SystemExit) as pytest_wrapped_e:
        serve._validate_ssl_keys('test.pem', 'test-key.pem')

    assert pytest_wrapped_e.type == SystemExit
    assert pytest_wrapped_e.value.code == "Cert file can't be found"


def test_validate_ssl_keys_with_non_existant_key_file(mock_os_path_exists):
    mock_os_path_exists.file_names_that_exist = ['test.pem']
    with pytest.raises(SystemExit) as pytest_wrapped_e:
        serve._validate_ssl_keys('test.pem', 'test-key.pem')

    assert pytest_wrapped_e.type == SystemExit
    assert pytest_wrapped_e.value.code == "Private key file can't be found"


def test_validate_ssl_keys_with_actual_keys(mock_os_path_exists):
    mock_os_path_exists.file_names_that_exist = ['test.pem', 'test-key.pem']
    return_value = serve._validate_ssl_keys('test.pem', 'test-key.pem')

    assert type(return_value) is tuple
    assert return_value[0] == 'test.pem'
    assert return_value[1] == 'test-key.pem'
