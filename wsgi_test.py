#!/usr/bin/env python
# -*- coding: utf-8 -*-
import __builtin__
import importlib
import os
from werkzeug.wrappers import Response


class ModuleStub:
    pass


class MockApp:
    def __call__(self, environ, start_response):
        self.last_environ = environ
        response = Response('Hello World!', mimetype='text/plain')
        return response(environ, start_response)


class MockFile():
    def __init__(self):
        self.contents = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def read(self):
        return self.contents

    def write(self, data):
        self.contents = data


class MockFileManager():
    def __init__(self):
        self.files = {}

    def open(self, name, mode='r', buffering=-1, **options):
        if name not in self.files:
            if mode.startswith('r'):
                raise IOError(2, "No such file or directory: '%s'" % name)
            else:
                self.files[name] = MockFile()

        return self.files[name]


def test_handler(monkeypatch):
    monkeypatch.setattr(os.path, 'abspath', lambda x: '/tmp')

    manager = MockFileManager()
    with manager.open('/tmp/.wsgi_app', 'w') as f:
        f.write('app.app')
    monkeypatch.setattr(__builtin__, 'open', manager.open)

    mock_app = MockApp()

    def mock_importlib(module):
        app = ModuleStub
        app.app = mock_app
        return app

    monkeypatch.setattr(importlib, 'import_module', mock_importlib)
    event = {
        'body': None,
        'headers': {
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'CloudFront-Forwarded-Proto': 'https',
            'CloudFront-Is-Desktop-Viewer': 'true',
            'CloudFront-Is-Mobile-Viewer': 'false',
            'CloudFront-Is-SmartTV-Viewer': 'false',
            'CloudFront-Is-Tablet-Viewer': 'false',
            'CloudFront-Viewer-Country': 'DK',
            'Cookie':
                'CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001',
            'Host': '3z6kd9fbb1.execute-api.us-east-1.amazonaws.com',
            'Postman-Token': '778a706e-d6b0-48d5-94dd-9e98c22f12fe',
            'User-Agent': 'PostmanRuntime/3.0.11-hotfix.2',
            'Via': '1.1 b8fa.cloudfront.net (CloudFront)',
            'X-Amz-Cf-Id': 'jx0Bvz9rm--Mz3wAj4i46FdOQQK3RHF4H0moJjBsQ==',
            'X-Amzn-Trace-Id': 'Root=1-58d534a5-1e7cffe644b086304dce7a1e',
            'X-Forwarded-For': '76.20.166.147, 205.251.218.72',
            'X-Forwarded-Port': '443',
            'X-Forwarded-Proto': 'https',
            'cache-control': 'no-cache'
        },
        'httpMethod': 'GET',
        'isBase64Encoded': False,
        'path': '/some/path',
        'pathParameters': {
            'proxy': 'some/path'
        },
        'queryStringParameters': {
            'param1': 'value1', 'param2': 'value2'
        },
        'requestContext': {
            'accountId': '16794',
            'apiId': '3z6kd9fbb1',
            'httpMethod': 'GET',
            'identity': {
                'accessKey': None,
                'accountId': None,
                'apiKey': None,
                'caller': None,
                'cognitoAuthenticationProvider': None,
                'cognitoAuthenticationType': None,
                'cognitoIdentityId': None,
                'cognitoIdentityPoolId': None,
                'sourceIp': '76.20.166.147',
                'user': None,
                'userAgent': 'PostmanRuntime/3.0.11-hotfix.2',
                'userArn': None
            },
            'requestId': 'ad2db740-10a2-11e7-8ced-35048084babb',
            'resourceId': 'r4kza9',
            'resourcePath': '/{proxy+}',
            'stage': 'dev'
        },
        'resource': '/{proxy+}',
        'stageVariables': None
    }

    import wsgi
    response = wsgi.handler(event, None)

    assert response == {
        'body': 'Hello World!',
        'headers': {
            'Content-Length': '12',
            'Content-Type': 'text/plain; charset=utf-8'
        },
        'statusCode': 200
    }

    assert mock_app.last_environ == {
        'CONTENT_LENGTH': '0',
        'CONTENT_TYPE': '',
        'HTTP_ACCEPT': '*/*',
        'HTTP_ACCEPT_ENCODING': 'gzip, deflate',
        'HTTP_CACHE_CONTROL': 'no-cache',
        'HTTP_CLOUDFRONT_FORWARDED_PROTO': 'https',
        'HTTP_CLOUDFRONT_IS_DESKTOP_VIEWER': 'true',
        'HTTP_CLOUDFRONT_IS_MOBILE_VIEWER': 'false',
        'HTTP_CLOUDFRONT_IS_SMARTTV_VIEWER': 'false',
        'HTTP_CLOUDFRONT_IS_TABLET_VIEWER': 'false',
        'HTTP_CLOUDFRONT_VIEWER_COUNTRY': 'DK',
        'HTTP_COOKIE':
            'CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001',
        'HTTP_HOST': '3z6kd9fbb1.execute-api.us-east-1.amazonaws.com',
        'HTTP_POSTMAN_TOKEN': '778a706e-d6b0-48d5-94dd-9e98c22f12fe',
        'HTTP_USER_AGENT': 'PostmanRuntime/3.0.11-hotfix.2',
        'HTTP_VIA': '1.1 b8fa.cloudfront.net (CloudFront)',
        'HTTP_X_AMZN_TRACE_ID': 'Root=1-58d534a5-1e7cffe644b086304dce7a1e',
        'HTTP_X_AMZ_CF_ID': 'jx0Bvz9rm--Mz3wAj4i46FdOQQK3RHF4H0moJjBsQ==',
        'HTTP_X_FORWARDED_FOR': '76.20.166.147, 205.251.218.72',
        'HTTP_X_FORWARDED_PORT': '443',
        'HTTP_X_FORWARDED_PROTO': 'https',
        'PATH_INFO': '/some/path',
        'QUERY_STRING': 'param2=value2&param1=value1',
        'REMOTE_ADDR': '76.20.166.147',
        'REMOTE_USER': '',
        'REQUEST_METHOD': 'GET',
        'SCRIPT_NAME': '/dev',
        'SERVER_NAME': '3z6kd9fbb1.execute-api.us-east-1.amazonaws.com',
        'SERVER_PORT': '443',
        'SERVER_PROTOCOL': 'HTTP/1.1',
        'wsgi.errors': mock_app.last_environ['wsgi.errors'],
        'wsgi.input': mock_app.last_environ['wsgi.input'],
        'wsgi.multiprocess': False,
        'wsgi.multithread': False,
        'wsgi.run_once': False,
        'wsgi.url_scheme': 'https',
        'wsgi.version': (1, 0)
    }
