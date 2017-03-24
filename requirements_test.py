#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import platform
import requirements
import shutil
import subprocess
import sys
import virtualenv
from functools import partial


class PopenStub:
    def communicate(self):
        self.returncode = 0


def test_package(monkeypatch):
    calls = []

    def mock_any(func, retval, *args, **kwargs):
        calls.append((func, args))
        return retval

    monkeypatch.setattr(
        os, 'listdir', partial(mock_any, 'os.listdir', ['dir1', 'dir2']))
    monkeypatch.setattr(
        os, 'mkdir', partial(mock_any, 'os.mkdir', None))
    monkeypatch.setattr(
        os, 'remove', partial(mock_any, 'os.remove', None))
    monkeypatch.setattr(
        os.path, 'isfile', partial(mock_any, 'os.path.isfile', True))
    monkeypatch.setattr(
        os.path, 'isdir', partial(mock_any, 'os.path.isdir', True))
    monkeypatch.setattr(
        os.path, 'exists', partial(mock_any, 'os.path.exists', True))
    monkeypatch.setattr(
        shutil, 'rmtree', partial(mock_any, 'shutil.rmtree', None))
    monkeypatch.setattr(
        shutil, 'copytree', partial(mock_any, 'shutil.copytree', None))
    monkeypatch.setattr(
        shutil, 'move', partial(mock_any, 'shutil.move', None))
    monkeypatch.setattr(
        platform, 'system', partial(mock_any, 'platform.system', 'Linux'))
    monkeypatch.setattr(
        subprocess, 'Popen', partial(
            mock_any, 'subprocess.Popen', PopenStub()))

    virtualenv_calls = []

    def mock_virtualenv():
        virtualenv_calls.append(sys.argv[:])

    monkeypatch.setattr(virtualenv, 'main', mock_virtualenv)

    requirements.package(
        ['/path1/requirements.txt', '/path2/requirements.txt'],
        '/tmp')

    assert len(virtualenv_calls) == 1
    assert virtualenv_calls[0] == ['', '/tmp/.venv', '--quiet']

    # Checks that requirements files exist
    assert calls.pop(0) == (
        'os.path.isfile', ('/path1/requirements.txt',))
    assert calls.pop(0) == (
        'os.path.isfile', ('/path2/requirements.txt',))

    # Checks that output dir exists
    assert calls.pop(0) == ('os.path.exists', ('/tmp',))
    assert calls.pop(0) == ('os.path.isdir', ('/tmp',))

    # Checks and removes existing venv/tmp dirs
    assert calls.pop(0) == ('os.path.exists', ('/tmp/.venv',))
    assert calls.pop(0) == ('shutil.rmtree', ('/tmp/.venv',))
    assert calls.pop(0) == ('os.path.exists', ('/tmp/.tmp',))
    assert calls.pop(0) == ('shutil.rmtree', ('/tmp/.tmp',))

    # Looks up system type
    assert calls.pop(0) == ('platform.system', ())

    # Looks for pip installation
    assert calls.pop(0) == ('os.listdir', ('/tmp/.venv/lib',))
    assert calls.pop(0) == ('os.path.isfile', ('/tmp/.venv/bin/pip',))

    # Invokes pip for package installation
    assert calls.pop(0) == (
        'subprocess.Popen', ([
            '/tmp/.venv/bin/pip',
            'install', '-r', '/path1/requirements.txt'],))
    assert calls.pop(0) == (
        'subprocess.Popen', ([
            '/tmp/.venv/bin/pip',
            'install', '-r', '/path2/requirements.txt'],))

    # Copies installed packages to temporary directory
    assert calls.pop(0) == (
        'os.path.isdir', ('/tmp/.venv/lib/dir1/site-packages',))
    assert calls.pop(0) == (
        'shutil.copytree', (
            '/tmp/.venv/lib/dir1/site-packages', '/tmp/.tmp'))

    # Lists installed packages
    assert calls.pop(0) == ('os.listdir', ('/tmp/.tmp',))

    # Clears existing installation of package 1
    assert calls.pop(0) == ('os.path.isdir', ('/tmp/dir1',))
    assert calls.pop(0) == ('shutil.rmtree', ('/tmp/dir1',))

    # Moves package 1 into place
    assert calls.pop(0) == (
        'shutil.move', ('/tmp/.tmp/dir1', '/tmp'))

    # Clears existing installation of package 2
    assert calls.pop(0) == ('os.path.isdir', ('/tmp/dir2',))
    assert calls.pop(0) == ('shutil.rmtree', ('/tmp/dir2',))

    # Moves package 2 into place
    assert calls.pop(0) == (
        'shutil.move', ('/tmp/.tmp/dir2', '/tmp'))

    # Performs final cleanup
    assert calls.pop(0) == ('shutil.rmtree', ('/tmp/.venv',))
    assert calls.pop(0) == ('shutil.rmtree', ('/tmp/.tmp',))
