#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import print_function

try:
    import __builtin__ as builtins
except ImportError:  # pragma: no cover
    import builtins

import importlib
import json
import os
import sys
import pytest
from werkzeug.wrappers import Request, Response
from werkzeug.urls import url_encode

PY2 = sys.version_info[0] == 2

# Reference to open() before monkeypatching
original_open = open


# This workaround is needed for coverage.py to pick up the wsgi module
try:
    import wsgi  # noqa: F401
except:  # noqa: E722
    pass


class MockApp:
    def __init__(self):
        self.cookie_count = 3
        self.response_mimetype = "text/plain"

    def __call__(self, environ, start_response):
        self.last_environ = environ
        response = Response(u"Hello World ☃!", mimetype=self.response_mimetype)
        cookies = [
            ("CUSTOMER", "WILE_E_COYOTE"),
            ("PART_NUMBER", "ROCKET_LAUNCHER_0002"),
            ("LOT_NUMBER", "42"),
        ]
        for cookie in cookies[: self.cookie_count]:
            response.set_cookie(cookie[0], cookie[1])
        print("application debug #1", file=environ["wsgi.errors"])
        return response(environ, start_response)


class MockFile:
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


class MockFileManager:
    def __init__(self):
        self.files = {}

    def open(self, name, mode="r", buffering=-1, **options):
        if name not in self.files:
            if mode.startswith("r"):  # pragma: no cover
                return original_open(name, mode, buffering, **options)
            else:
                self.files[name] = MockFile()

        return self.files[name]


@pytest.fixture
def mock_app(monkeypatch):
    mock_app = MockApp()

    def mock_importlib(module):
        class MockObject:
            pass

        app = MockObject()
        app.app = mock_app
        app.app.module = module
        return app

    monkeypatch.setattr(importlib, "import_module", mock_importlib)

    return mock_app


@pytest.fixture
def mock_app_with_import_error(monkeypatch):
    def mock_importlib(module):
        raise ImportError("No module named {}".format(module))

    monkeypatch.setattr(importlib, "import_module", mock_importlib)


@pytest.fixture
def mock_wsgi_app_file(monkeypatch):
    monkeypatch.setattr(os.path, "abspath", lambda x: "/tmp")

    manager = MockFileManager()
    with manager.open("/tmp/.wsgi_app", "w") as f:
        f.write(json.dumps({"app": "app.app"}))
    monkeypatch.setattr(builtins, "open", manager.open)


@pytest.fixture
def mock_subdir_wsgi_app_file(monkeypatch):
    monkeypatch.setattr(os.path, "abspath", lambda x: "/tmp")

    manager = MockFileManager()
    with manager.open("/tmp/.wsgi_app", "w") as f:
        f.write(json.dumps({"app": "subdir/app.app"}))
    monkeypatch.setattr(builtins, "open", manager.open)


@pytest.fixture
def mock_text_mime_wsgi_app_file(monkeypatch):
    monkeypatch.setattr(os.path, "abspath", lambda x: "/tmp")

    manager = MockFileManager()
    with manager.open("/tmp/.wsgi_app", "w") as f:
        f.write(
            json.dumps(
                {"app": "app.app", "text_mime_types": ["application/custom+json"]}
            )
        )
    monkeypatch.setattr(builtins, "open", manager.open)


@pytest.fixture
def event():
    return {
        "body": None,
        "headers": {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate",
            "CloudFront-Forwarded-Proto": "https",
            "CloudFront-Is-Desktop-Viewer": "true",
            "CloudFront-Is-Mobile-Viewer": "false",
            "CloudFront-Is-SmartTV-Viewer": "false",
            "CloudFront-Is-Tablet-Viewer": "false",
            "CloudFront-Viewer-Country": "DK",
            "Cookie": "CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001",
            "Host": "3z6kd9fbb1.execute-api.us-east-1.amazonaws.com",
            "Postman-Token": "778a706e-d6b0-48d5-94dd-9e98c22f12fe",
            "User-Agent": "PostmanRuntime/3.0.11-hotfix.2",
            "Via": "1.1 b8fa.cloudfront.net (CloudFront)",
            "X-Amz-Cf-Id": "jx0Bvz9rm--Mz3wAj4i46FdOQQK3RHF4H0moJjBsQ==",
            "X-Amzn-Trace-Id": "Root=1-58d534a5-1e7cffe644b086304dce7a1e",
            "X-Forwarded-For": "76.20.166.147, 205.251.218.72",
            "X-Forwarded-Port": "443",
            "X-Forwarded-Proto": "https",
            "cache-control": "no-cache",
        },
        "httpMethod": "GET",
        "isBase64Encoded": False,
        "path": "/some/path",
        "pathParameters": {"proxy": "some/path"},
        "queryStringParameters": {"param1": "value1", "param2": "value2"},
        "requestContext": {
            "accountId": "16794",
            "apiId": "3z6kd9fbb1",
            "httpMethod": "GET",
            "identity": {
                "accessKey": None,
                "accountId": None,
                "apiKey": None,
                "caller": None,
                "cognitoAuthenticationProvider": None,
                "cognitoAuthenticationType": None,
                "cognitoIdentityId": None,
                "cognitoIdentityPoolId": None,
                "sourceIp": "76.20.166.147",
                "user": None,
                "userAgent": "PostmanRuntime/3.0.11-hotfix.2",
                "userArn": None,
            },
            "authorizer": {"principalId": "wile_e_coyote"},
            "requestId": "ad2db740-10a2-11e7-8ced-35048084babb",
            "resourceId": "r4kza9",
            "resourcePath": "/{proxy+}",
            "stage": "dev",
        },
        "resource": "/{proxy+}",
        "stageVariables": None,
    }


@pytest.fixture  # noqa: F811
def wsgi():
    if "wsgi" in sys.modules:
        del sys.modules["wsgi"]
    import wsgi

    return wsgi


def test_handler(mock_wsgi_app_file, mock_app, event, capsys, wsgi):
    response = wsgi.handler(event, {"memory_limit_in_mb": "128"})

    assert response == {
        "body": u"Hello World ☃!",
        "headers": {
            "set-cookie": "CUSTOMER=WILE_E_COYOTE; Path=/",
            "Content-Length": "16",
            "Content-Type": "text/plain; charset=utf-8",
            "sEt-cookie": "LOT_NUMBER=42; Path=/",
            "Set-cookie": "PART_NUMBER=ROCKET_LAUNCHER_0002; Path=/",
        },
        "statusCode": 200,
        "isBase64Encoded": False,
    }

    assert wsgi.wsgi_app.last_environ == {
        "API_GATEWAY_AUTHORIZER": {"principalId": "wile_e_coyote"},
        "CONTENT_LENGTH": "0",
        "CONTENT_TYPE": "",
        "HTTP_ACCEPT": "*/*",
        "HTTP_ACCEPT_ENCODING": "gzip, deflate",
        "HTTP_CACHE_CONTROL": "no-cache",
        "HTTP_CLOUDFRONT_FORWARDED_PROTO": "https",
        "HTTP_CLOUDFRONT_IS_DESKTOP_VIEWER": "true",
        "HTTP_CLOUDFRONT_IS_MOBILE_VIEWER": "false",
        "HTTP_CLOUDFRONT_IS_SMARTTV_VIEWER": "false",
        "HTTP_CLOUDFRONT_IS_TABLET_VIEWER": "false",
        "HTTP_CLOUDFRONT_VIEWER_COUNTRY": "DK",
        "HTTP_COOKIE": "CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001",
        "HTTP_HOST": "3z6kd9fbb1.execute-api.us-east-1.amazonaws.com",
        "HTTP_POSTMAN_TOKEN": "778a706e-d6b0-48d5-94dd-9e98c22f12fe",
        "HTTP_USER_AGENT": "PostmanRuntime/3.0.11-hotfix.2",
        "HTTP_VIA": "1.1 b8fa.cloudfront.net (CloudFront)",
        "HTTP_X_AMZN_TRACE_ID": "Root=1-58d534a5-1e7cffe644b086304dce7a1e",
        "HTTP_X_AMZ_CF_ID": "jx0Bvz9rm--Mz3wAj4i46FdOQQK3RHF4H0moJjBsQ==",
        "HTTP_X_FORWARDED_FOR": "76.20.166.147, 205.251.218.72",
        "HTTP_X_FORWARDED_PORT": "443",
        "HTTP_X_FORWARDED_PROTO": "https",
        "PATH_INFO": "/some/path",
        "QUERY_STRING": url_encode(event["queryStringParameters"]),
        "REMOTE_ADDR": "76.20.166.147",
        "REMOTE_USER": "wile_e_coyote",
        "REQUEST_METHOD": "GET",
        "SCRIPT_NAME": "/dev",
        "SERVER_NAME": "3z6kd9fbb1.execute-api.us-east-1.amazonaws.com",
        "SERVER_PORT": "443",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.errors": wsgi.wsgi_app.last_environ["wsgi.errors"],
        "wsgi.input": wsgi.wsgi_app.last_environ["wsgi.input"],
        "wsgi.multiprocess": False,
        "wsgi.multithread": False,
        "wsgi.run_once": False,
        "wsgi.url_scheme": "https",
        "wsgi.version": (1, 0),
        "context": {"memory_limit_in_mb": "128"},
        "event": event,
    }

    out, err = capsys.readouterr()
    assert out == ""
    assert err == "application debug #1\n"


def test_handler_china(mock_wsgi_app_file, mock_app, event, capsys, wsgi):
    event["headers"]["Host"] = "x.amazonaws.com.cn"
    wsgi.handler(event, {"memory_limit_in_mb": "128"})

    assert wsgi.wsgi_app.last_environ["SCRIPT_NAME"] == "/dev"


def test_handler_single_cookie(mock_wsgi_app_file, mock_app, event, wsgi):
    wsgi.wsgi_app.cookie_count = 1
    response = wsgi.handler(event, {})

    assert response == {
        "body": u"Hello World ☃!",
        "headers": {
            "Set-Cookie": "CUSTOMER=WILE_E_COYOTE; Path=/",
            "Content-Length": "16",
            "Content-Type": "text/plain; charset=utf-8",
        },
        "statusCode": 200,
        "isBase64Encoded": False,
    }


def test_handler_no_cookie(mock_wsgi_app_file, mock_app, event, wsgi):
    wsgi.wsgi_app.cookie_count = 0
    response = wsgi.handler(event, {})

    assert response == {
        "body": u"Hello World ☃!",
        "headers": {
            "Content-Length": "16",
            "Content-Type": "text/plain; charset=utf-8",
        },
        "statusCode": 200,
        "isBase64Encoded": False,
    }


def test_handler_schedule(mock_wsgi_app_file, mock_app, event, wsgi):
    event = {"source": "aws.events"}
    response = wsgi.handler(event, {})
    assert response == {}


def test_handler_warmup_plugin(mock_wsgi_app_file, mock_app, event, wsgi):
    event = {"source": "serverless-plugin-warmup"}
    response = wsgi.handler(event, {})
    assert response == {}


def test_handler_custom_domain(mock_wsgi_app_file, mock_app, event, wsgi):
    event["headers"]["Host"] = "custom.domain.com"
    wsgi.handler(event, {})

    assert wsgi.wsgi_app.last_environ == {
        "API_GATEWAY_AUTHORIZER": {"principalId": "wile_e_coyote"},
        "CONTENT_LENGTH": "0",
        "CONTENT_TYPE": "",
        "HTTP_ACCEPT": "*/*",
        "HTTP_ACCEPT_ENCODING": "gzip, deflate",
        "HTTP_CACHE_CONTROL": "no-cache",
        "HTTP_CLOUDFRONT_FORWARDED_PROTO": "https",
        "HTTP_CLOUDFRONT_IS_DESKTOP_VIEWER": "true",
        "HTTP_CLOUDFRONT_IS_MOBILE_VIEWER": "false",
        "HTTP_CLOUDFRONT_IS_SMARTTV_VIEWER": "false",
        "HTTP_CLOUDFRONT_IS_TABLET_VIEWER": "false",
        "HTTP_CLOUDFRONT_VIEWER_COUNTRY": "DK",
        "HTTP_COOKIE": "CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001",
        "HTTP_HOST": "custom.domain.com",
        "HTTP_POSTMAN_TOKEN": "778a706e-d6b0-48d5-94dd-9e98c22f12fe",
        "HTTP_USER_AGENT": "PostmanRuntime/3.0.11-hotfix.2",
        "HTTP_VIA": "1.1 b8fa.cloudfront.net (CloudFront)",
        "HTTP_X_AMZN_TRACE_ID": "Root=1-58d534a5-1e7cffe644b086304dce7a1e",
        "HTTP_X_AMZ_CF_ID": "jx0Bvz9rm--Mz3wAj4i46FdOQQK3RHF4H0moJjBsQ==",
        "HTTP_X_FORWARDED_FOR": "76.20.166.147, 205.251.218.72",
        "HTTP_X_FORWARDED_PORT": "443",
        "HTTP_X_FORWARDED_PROTO": "https",
        "PATH_INFO": "/some/path",
        "QUERY_STRING": url_encode(event["queryStringParameters"]),
        "REMOTE_ADDR": "76.20.166.147",
        "REMOTE_USER": "wile_e_coyote",
        "REQUEST_METHOD": "GET",
        "SCRIPT_NAME": "",
        "SERVER_NAME": "custom.domain.com",
        "SERVER_PORT": "443",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.errors": wsgi.wsgi_app.last_environ["wsgi.errors"],
        "wsgi.input": wsgi.wsgi_app.last_environ["wsgi.input"],
        "wsgi.multiprocess": False,
        "wsgi.multithread": False,
        "wsgi.run_once": False,
        "wsgi.url_scheme": "https",
        "wsgi.version": (1, 0),
        "context": {},
        "event": event,
    }


def test_handler_api_gateway_base_path(mock_wsgi_app_file, mock_app, event, wsgi):
    event["headers"]["Host"] = "custom.domain.com"
    event["path"] = "/prod/some/path"
    os.environ.update(API_GATEWAY_BASE_PATH="prod")
    wsgi.handler(event, {})

    assert wsgi.wsgi_app.last_environ == {
        "API_GATEWAY_AUTHORIZER": {"principalId": "wile_e_coyote"},
        "CONTENT_LENGTH": "0",
        "CONTENT_TYPE": "",
        "HTTP_ACCEPT": "*/*",
        "HTTP_ACCEPT_ENCODING": "gzip, deflate",
        "HTTP_CACHE_CONTROL": "no-cache",
        "HTTP_CLOUDFRONT_FORWARDED_PROTO": "https",
        "HTTP_CLOUDFRONT_IS_DESKTOP_VIEWER": "true",
        "HTTP_CLOUDFRONT_IS_MOBILE_VIEWER": "false",
        "HTTP_CLOUDFRONT_IS_SMARTTV_VIEWER": "false",
        "HTTP_CLOUDFRONT_IS_TABLET_VIEWER": "false",
        "HTTP_CLOUDFRONT_VIEWER_COUNTRY": "DK",
        "HTTP_COOKIE": "CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001",
        "HTTP_HOST": "custom.domain.com",
        "HTTP_POSTMAN_TOKEN": "778a706e-d6b0-48d5-94dd-9e98c22f12fe",
        "HTTP_USER_AGENT": "PostmanRuntime/3.0.11-hotfix.2",
        "HTTP_VIA": "1.1 b8fa.cloudfront.net (CloudFront)",
        "HTTP_X_AMZN_TRACE_ID": "Root=1-58d534a5-1e7cffe644b086304dce7a1e",
        "HTTP_X_AMZ_CF_ID": "jx0Bvz9rm--Mz3wAj4i46FdOQQK3RHF4H0moJjBsQ==",
        "HTTP_X_FORWARDED_FOR": "76.20.166.147, 205.251.218.72",
        "HTTP_X_FORWARDED_PORT": "443",
        "HTTP_X_FORWARDED_PROTO": "https",
        "PATH_INFO": "/some/path",
        "QUERY_STRING": url_encode(event["queryStringParameters"]),
        "REMOTE_ADDR": "76.20.166.147",
        "REMOTE_USER": "wile_e_coyote",
        "REQUEST_METHOD": "GET",
        "SCRIPT_NAME": "/prod",
        "SERVER_NAME": "custom.domain.com",
        "SERVER_PORT": "443",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.errors": wsgi.wsgi_app.last_environ["wsgi.errors"],
        "wsgi.input": wsgi.wsgi_app.last_environ["wsgi.input"],
        "wsgi.multiprocess": False,
        "wsgi.multithread": False,
        "wsgi.run_once": False,
        "wsgi.url_scheme": "https",
        "wsgi.version": (1, 0),
        "context": {},
        "event": event,
    }


def test_handler_base64(mock_wsgi_app_file, mock_app, event, wsgi):
    wsgi.wsgi_app.cookie_count = 1
    wsgi.wsgi_app.response_mimetype = "image/jpeg"
    response = wsgi.handler(event, {})

    assert response == {
        "body": u"SGVsbG8gV29ybGQg4piDIQ==",
        "headers": {
            "Set-Cookie": "CUSTOMER=WILE_E_COYOTE; Path=/",
            "Content-Length": "16",
            "Content-Type": "image/jpeg",
        },
        "statusCode": 200,
        "isBase64Encoded": True,
    }


def test_handler_plain(mock_wsgi_app_file, mock_app, event, wsgi):
    wsgi.wsgi_app.cookie_count = 1

    plain_mimetypes = [
        "application/vnd.api+json",
        "application/javascript",
        "image/svg+xml",
    ]

    for mimetype in plain_mimetypes:
        wsgi.wsgi_app.response_mimetype = mimetype
        response = wsgi.handler(event, {})

        assert response == {
            "body": u"Hello World ☃!",
            "headers": {
                "Set-Cookie": "CUSTOMER=WILE_E_COYOTE; Path=/",
                "Content-Length": "16",
                "Content-Type": mimetype,
            },
            "statusCode": 200,
            "isBase64Encoded": False,
        }


def test_handler_base64_request(mock_wsgi_app_file, mock_app, event, wsgi):
    event["body"] = "SGVsbG8gd29ybGQ="
    event["headers"]["Content-Type"] = "text/plain"
    event["isBase64Encoded"] = True
    event["httpMethod"] = "PUT"

    wsgi.handler(event, {})

    environ = wsgi.wsgi_app.last_environ

    assert environ["CONTENT_TYPE"] == "text/plain"
    assert environ["CONTENT_LENGTH"] == "11"
    assert environ["REQUEST_METHOD"] == "PUT"
    assert environ["wsgi.input"].getvalue().decode() == "Hello world"


def test_non_package_subdir_app(mock_subdir_wsgi_app_file, mock_app, wsgi):
    assert wsgi.wsgi_app.module == "app"


def test_handler_binary_request_body(mock_wsgi_app_file, mock_app, event, wsgi):
    event["body"] = (
        u"LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5VTRDZE5CRWVLQWxIaGRRcQ0KQ29udGVu"
        u"dC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJ3YXQiDQoNCmhleW9vb3Bw"
        u"cHBwDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlVNENkTkJFZUtBbEhoZFFxDQpD"
        u"b250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZpbGVUb1VwbG9h"
        u"ZCI7IGZpbGVuYW1lPSJGRjREMDAtMC44LnBuZyINCkNvbnRlbnQtVHlwZTogaW1h"
        u"Z2UvcG5nDQoNColQTkcNChoKAAAADUlIRFIAAAABAAAAAQEDAAAAJdtWygAAAANQ"
        u"TFRF/00AXDU4fwAAAAF0Uk5TzNI0Vv0AAAAKSURBVHicY2IAAAAGAAM2N3yoAAAA"
        u"AElFTkSuQmCCDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlVNENkTkJFZUtBbEho"
        u"ZFFxDQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9InN1Ym1p"
        u"dCINCg0KVXBsb2FkIEltYWdlDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlVNENk"
        u"TkJFZUtBbEhoZFFxLS0NCg=="
    )
    event["headers"][
        "Content-Type"
    ] = "multipart/form-data; boundary=----WebKitFormBoundaryU4CdNBEeKAlHhdQq"
    event["isBase64Encoded"] = True
    event["httpMethod"] = "POST"

    wsgi.handler(event, {})

    environ = wsgi.wsgi_app.last_environ

    assert environ["CONTENT_LENGTH"] == "496"
    assert Request(environ).form["submit"] == u"Upload Image"


def test_handler_request_body_undecodable_with_latin1(
    mock_wsgi_app_file, mock_app, event, wsgi
):
    event["body"] = (
        u"------WebKitFormBoundary3vA72kRLuq9D3NdL\r\n"
        u'Content-Disposition: form-data; name="text"\r\n\r\n'
        u"テスト 테스트 测试\r\n"
        u"------WebKitFormBoundary3vA72kRLuq9D3NdL--"
    )
    event["headers"][
        "Content-Type"
    ] = "multipart/form-data; boundary=----WebKitFormBoundary3vA72kRLuq9D3NdL"
    event["httpMethod"] = "POST"

    wsgi.handler(event, {})

    environ = wsgi.wsgi_app.last_environ
    assert Request(environ).form["text"] == u"テスト 테스트 测试"


def test_handler_custom_text_mime_types(
    mock_text_mime_wsgi_app_file, mock_app, event, wsgi
):
    wsgi.wsgi_app.cookie_count = 1
    wsgi.wsgi_app.response_mimetype = "application/custom+json"
    response = wsgi.handler(event, {})

    assert response == {
        "body": u"Hello World ☃!",
        "headers": {
            "Set-Cookie": "CUSTOMER=WILE_E_COYOTE; Path=/",
            "Content-Length": "16",
            "Content-Type": "application/custom+json",
        },
        "statusCode": 200,
        "isBase64Encoded": False,
    }


def test_handler_alb(mock_wsgi_app_file, mock_app, wsgi):
    response = wsgi.handler(
        {
            "requestContext": {
                "elb": {
                    "targetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:12345:targetgroup/xxxx/5e43816d76759862"
                }
            },
            "httpMethod": "GET",
            "path": "/cats",
            "queryStringParameters": {},
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "accept-encoding": "gzip, deflate",
                "accept-language": "en-US,en;q=0.9,da;q=0.8",
                "cache-control": "max-age=0",
                "connection": "keep-alive",
                "host": "xxxx-203391234.us-east-1.elb.amazonaws.com",
                "upgrade-insecure-requests": "1",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36",
                "x-amzn-trace-id": "Root=1-5f05949b-77e2b0f9434e2acbf5ad8ce8",
                "x-forwarded-for": "95.181.37.218",
                "x-forwarded-port": "80",
                "x-forwarded-proto": "http",
            },
            "body": "",
            "isBase64Encoded": False,
        },
        {},
    )

    assert response == {
        "body": u"Hello World ☃!",
        "headers": {
            "set-cookie": "CUSTOMER=WILE_E_COYOTE; Path=/",
            "Content-Length": "16",
            "Content-Type": "text/plain; charset=utf-8",
            "sEt-cookie": "LOT_NUMBER=42; Path=/",
            "Set-cookie": "PART_NUMBER=ROCKET_LAUNCHER_0002; Path=/",
        },
        "statusDescription": "200 OK",
        "statusCode": 200,
        "isBase64Encoded": False,
    }


def test_command_exec(mock_wsgi_app_file, mock_app, wsgi):
    response = wsgi.handler(
        {"_serverless-wsgi": {"command": "exec", "data": "print(1+4)"}}, {}
    )

    assert response == "5\n"

    response = wsgi.handler(
        {"_serverless-wsgi": {"command": "exec", "data": "invalid code"}}, {}
    )

    assert "Traceback (most recent call last):" in response
    assert "SyntaxError: invalid syntax" in response


def test_command_command(mock_wsgi_app_file, mock_app, wsgi):
    response = wsgi.handler(
        {"_serverless-wsgi": {"command": "command", "data": 'echo "hello world"'}}, {}
    )

    assert response == "hello world\n"


def test_command_manage(mock_wsgi_app_file, mock_app, wsgi):
    class MockObject:
        pass

    class MockDjango:
        def call_command(*args):
            print("Called with: {}".format(", ".join(args[1:])))

    sys.modules["django"] = MockObject()
    sys.modules["django.core"] = MockObject()
    sys.modules["django.core"].management = MockDjango()

    response = wsgi.handler(
        {"_serverless-wsgi": {"command": "manage", "data": "check --list-tags"}}, {}
    )

    assert response == "Called with: check, --list-tags\n"


def test_command_unknown(mock_wsgi_app_file, mock_app, wsgi):
    response = wsgi.handler(
        {"_serverless-wsgi": {"command": "unknown", "data": 'echo "hello world"'}}, {}
    )

    assert "Traceback (most recent call last):" in response
    assert "Exception: Uknown command: unknown" in response


def test_app_import_error(mock_wsgi_app_file, mock_app_with_import_error, event):
    with pytest.raises(Exception, message="Unable to import app.app"):
        if "wsgi" in sys.modules:
            del sys.modules["wsgi"]
        import wsgi  # noqa: F401
