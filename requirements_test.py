#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import platform
import pytest
import requirements
import shutil
import subprocess
import sys
import virtualenv
from functools import partial


class PopenStub:
    def __init__(self, returncode):
        self.returncode = returncode

    def communicate(self):
        self.returncode = self.returncode


@pytest.fixture
def mock_virtualenv(monkeypatch):
    virtualenv_calls = []

    def mock_virtualenv_main():
        virtualenv_calls.append(sys.argv[:])

    monkeypatch.setattr(virtualenv, 'main', mock_virtualenv_main)

    return virtualenv_calls


@pytest.fixture
def mock_system(monkeypatch):
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
            mock_any, 'subprocess.Popen', PopenStub(0)))

    return calls


def test_package(mock_system, mock_virtualenv):
    requirements.package(
        ['/path1/requirements.txt', '/path2/requirements.txt'],
        '/tmp')

    assert len(mock_virtualenv) == 1
    assert mock_virtualenv[0] == [
        '', '/tmp/.venv', '--quiet', '-p', sys.executable]

    # Checks that requirements files exist
    assert mock_system.pop(0) == (
        'os.path.isfile', ('/path1/requirements.txt',))
    assert mock_system.pop(0) == (
        'os.path.isfile', ('/path2/requirements.txt',))

    # Checks that output dir exists
    assert mock_system.pop(0) == ('os.path.exists', ('/tmp',))
    assert mock_system.pop(0) == ('os.path.isdir', ('/tmp',))

    # Checks and removes existing venv/tmp dirs
    assert mock_system.pop(0) == ('os.path.exists', ('/tmp/.venv',))
    assert mock_system.pop(0) == ('shutil.rmtree', ('/tmp/.venv',))
    assert mock_system.pop(0) == ('os.path.exists', ('/tmp/.tmp',))
    assert mock_system.pop(0) == ('shutil.rmtree', ('/tmp/.tmp',))

    # Looks up system type
    assert mock_system.pop(0) == ('platform.system', ())

    # Looks for pip installation
    assert mock_system.pop(0) == ('os.listdir', ('/tmp/.venv/lib',))

    assert mock_system.pop(0) == ('os.path.isdir', ('/tmp/.venv/lib/dir1',))
    assert mock_system.pop(0) == ('os.path.isdir', ('/tmp/.venv/lib/dir2',))

    assert mock_system.pop(0) == ('os.path.isfile', ('/tmp/.venv/bin/pip',))

    # Invokes pip for package installation
    assert mock_system.pop(0) == (
        'subprocess.Popen', ([
            '/tmp/.venv/bin/pip',
            'install', '-r', '/path1/requirements.txt'],))
    assert mock_system.pop(0) == (
        'subprocess.Popen', ([
            '/tmp/.venv/bin/pip',
            'install', '-r', '/path2/requirements.txt'],))

    # Copies installed packages to temporary directory
    assert mock_system.pop(0) == (
        'os.path.isdir', ('/tmp/.venv/lib/dir1/site-packages',))
    assert mock_system.pop(0) == (
        'shutil.copytree', (
            '/tmp/.venv/lib/dir1/site-packages', '/tmp/.tmp'))

    # Lists installed packages
    assert mock_system.pop(0) == ('os.listdir', ('/tmp/.tmp',))

    # Clears existing installation of package 1
    assert mock_system.pop(0) == ('os.path.isdir', ('/tmp/dir1',))
    assert mock_system.pop(0) == ('shutil.rmtree', ('/tmp/dir1',))

    # Moves package 1 into place
    assert mock_system.pop(0) == (
        'shutil.move', ('/tmp/.tmp/dir1', '/tmp'))

    # Clears existing installation of package 2
    assert mock_system.pop(0) == ('os.path.isdir', ('/tmp/dir2',))
    assert mock_system.pop(0) == ('shutil.rmtree', ('/tmp/dir2',))

    # Moves package 2 into place
    assert mock_system.pop(0) == (
        'shutil.move', ('/tmp/.tmp/dir2', '/tmp'))

    # Performs final cleanup
    assert mock_system.pop(0) == ('shutil.rmtree', ('/tmp/.venv',))
    assert mock_system.pop(0) == ('shutil.rmtree', ('/tmp/.tmp',))


def test_package_missing_requirements_file(mock_system, mock_virtualenv,
                                           monkeypatch):
    monkeypatch.setattr(os.path, 'isfile', lambda f: False)

    with pytest.raises(SystemExit):
        requirements.package(
            ['/path1/requirements.txt'], '/tmp')


def test_package_existing_target_file(mock_system, mock_virtualenv,
                                      monkeypatch):
    monkeypatch.setattr(os.path, 'isdir', lambda f: False)

    with pytest.raises(SystemExit):
        requirements.package(
            ['/path1/requirements.txt'], '/tmp')


def test_package_windows(mock_system, mock_virtualenv, monkeypatch):
    monkeypatch.setattr(platform, 'system', lambda: 'Windows')

    requirements.package(
            ['/path1/requirements.txt'], '/tmp')

    pip_calls = [c for c in mock_system if c[0] == 'subprocess.Popen']

    assert pip_calls[0] == (
        'subprocess.Popen', ([
            '/tmp/.venv/Scripts/pip.exe',
            'install', '-r', '/path1/requirements.txt'],))


def test_pip_error(mock_system, mock_virtualenv, monkeypatch):
    monkeypatch.setattr(
        subprocess, 'Popen', lambda *args, **kwargs: PopenStub(1))

    with pytest.raises(SystemExit):
        requirements.package(
            ['/path1/requirements.txt'], '/tmp')
