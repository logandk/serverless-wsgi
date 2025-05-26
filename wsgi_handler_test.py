#!/usr/bin/env python
# -*- coding: utf-8 -*-
import builtins
import importlib
import json
import os
import pytest
import sys
from urllib.parse import urlencode
from werkzeug.wrappers import Request, Response

# Reference to open() before monkeypatching
original_open = open

# This workaround is needed for coverage.py to pick up the wsgi handler module
try:
    import wsgi_handler  # noqa: F401
except:  # noqa: E722
    pass


class MockApp:
    def __init__(self):
        self.cookie_count = 3
        self.response_mimetype = "text/plain"
        self.status_code = 200

    def __call__(self, environ, start_response):
        self.last_environ = environ
        response = Response("Hello World ☃!", mimetype=self.response_mimetype)
        cookies = [
            ("CUSTOMER", "WILE_E_COYOTE"),
            ("PART_NUMBER", "ROCKET_LAUNCHER_0002"),
            ("LOT_NUMBER", "42"),
        ]
        for cookie in cookies[: self.cookie_count]:
            response.set_cookie(cookie[0], cookie[1])
        print("application debug #1", file=environ["wsgi.errors"])
        response.status_code = self.status_code
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
    with manager.open("/tmp/.serverless-wsgi", "w") as f:
        f.write(json.dumps({"app": "app.app"}))
    monkeypatch.setattr(builtins, "open", manager.open)


@pytest.fixture
def mock_subdir_wsgi_app_file(monkeypatch):
    monkeypatch.setattr(os.path, "abspath", lambda x: "/tmp")

    manager = MockFileManager()
    with manager.open("/tmp/.serverless-wsgi", "w") as f:
        f.write(json.dumps({"app": "subdir/app.app"}))
    monkeypatch.setattr(builtins, "open", manager.open)


@pytest.fixture
def mock_text_mime_wsgi_app_file(monkeypatch):
    monkeypatch.setattr(os.path, "abspath", lambda x: "/tmp")

    manager = MockFileManager()
    with manager.open("/tmp/.serverless-wsgi", "w") as f:
        f.write(
            json.dumps(
                {"app": "app.app", "text_mime_types": [
                    "application/custom+json"]}
            )
        )
    monkeypatch.setattr(builtins, "open", manager.open)


@pytest.fixture
def event_v1():
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


@pytest.fixture
def event_v1_offline(event_v1):
    event = event_v1
    del event["body"]
    return event


@pytest.fixture
def elb_event():
    return {
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
    }


@pytest.fixture  # noqa: F811
def wsgi_handler():  # noqa: F811
    if "wsgi_handler" in sys.modules:
        del sys.modules["wsgi_handler"]
    import wsgi_handler

    return wsgi_handler


def test_handler(mock_wsgi_app_file, mock_app, event_v1, capsys, wsgi_handler):
    response = wsgi_handler.handler(event_v1, {"memory_limit_in_mb": "128"})

    assert response == {
        "body": "Hello World ☃!",
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

    assert wsgi_handler.wsgi_app.last_environ == {
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
        "QUERY_STRING": urlencode(event_v1["queryStringParameters"], doseq=True),
        "REMOTE_ADDR": "76.20.166.147",
        "REMOTE_USER": "wile_e_coyote",
        "REQUEST_METHOD": "GET",
        "SCRIPT_NAME": "/dev",
        "SERVER_NAME": "3z6kd9fbb1.execute-api.us-east-1.amazonaws.com",
        "SERVER_PORT": "443",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.errors": wsgi_handler.wsgi_app.last_environ["wsgi.errors"],
        "wsgi.input": wsgi_handler.wsgi_app.last_environ["wsgi.input"],
        "wsgi.multiprocess": False,
        "wsgi.multithread": False,
        "wsgi.run_once": False,
        "wsgi.url_scheme": "https",
        "wsgi.version": (1, 0),
        "serverless.authorizer": {"principalId": "wile_e_coyote"},
        "serverless.context": {"memory_limit_in_mb": "128"},
        "serverless.event": event_v1,
    }

    out, err = capsys.readouterr()
    assert out == ""
    assert err == "application debug #1\n"


def test_handler_offline(mock_wsgi_app_file, mock_app, event_v1_offline, wsgi_handler):
    response = wsgi_handler.handler(
        event_v1_offline, {"memory_limit_in_mb": "128"})

    assert response["body"] == "Hello World ☃!"


def test_handler_multivalue(
    mock_wsgi_app_file, mock_app, event_v1, capsys, wsgi_handler
):
    event_v1["multiValueQueryStringParameters"] = {
        "param1": ["value1"],
        "param2": ["value2", "value3"],
    }

    # Convert regular headers request to multiValueHeaders
    multi_headers = {}
    for key, value in event_v1["headers"].items():
        if key not in multi_headers:
            multi_headers[key] = []
        multi_headers[key].append(value)

    event_v1["multiValueHeaders"] = multi_headers
    response = wsgi_handler.handler(event_v1, {"memory_limit_in_mb": "128"})
    query_string = wsgi_handler.wsgi_app.last_environ["QUERY_STRING"]

    print(query_string)
    assert query_string == urlencode(
        [
            (i, k)
            for i, j in event_v1["multiValueQueryStringParameters"].items()
            for k in j
        ],
        doseq=True
    )

    assert response == {
        "body": "Hello World ☃!",
        "multiValueHeaders": {
            "Content-Length": ["16"],
            "Content-Type": ["text/plain; charset=utf-8"],
            "Set-Cookie": [
                "CUSTOMER=WILE_E_COYOTE; Path=/",
                "PART_NUMBER=ROCKET_LAUNCHER_0002; Path=/",
                "LOT_NUMBER=42; Path=/",
            ],
        },
        "statusCode": 200,
        "isBase64Encoded": False,
    }


def test_handler_china(mock_wsgi_app_file, mock_app, event_v1, capsys, wsgi_handler):
    event_v1["headers"]["Host"] = "x.amazonaws.com.cn"
    wsgi_handler.handler(event_v1, {"memory_limit_in_mb": "128"})

    assert wsgi_handler.wsgi_app.last_environ["SCRIPT_NAME"] == "/dev"


def test_handler_single_cookie(mock_wsgi_app_file, mock_app, event_v1, wsgi_handler):
    wsgi_handler.wsgi_app.cookie_count = 1
    response = wsgi_handler.handler(event_v1, {})

    assert response == {
        "body": "Hello World ☃!",
        "headers": {
            "Set-Cookie": "CUSTOMER=WILE_E_COYOTE; Path=/",
            "Content-Length": "16",
            "Content-Type": "text/plain; charset=utf-8",
        },
        "statusCode": 200,
        "isBase64Encoded": False,
    }


def test_handler_no_cookie(mock_wsgi_app_file, mock_app, event_v1, wsgi_handler):
    wsgi_handler.wsgi_app.cookie_count = 0
    response = wsgi_handler.handler(event_v1, {})

    assert response == {
        "body": "Hello World ☃!",
        "headers": {
            "Content-Length": "16",
            "Content-Type": "text/plain; charset=utf-8",
        },
        "statusCode": 200,
        "isBase64Encoded": False,
    }


def test_handler_schedule(mock_wsgi_app_file, mock_app, event_v1, wsgi_handler):
    event_v1 = {"source": "aws.events"}
    response = wsgi_handler.handler(event_v1, {})
    assert response == {}


def test_handler_warmup_plugin(
    mock_wsgi_app_file, mock_app, event_v1, wsgi_handler, capsys
):
    event_v1 = {"source": "serverless-plugin-warmup"}
    response = wsgi_handler.handler(event_v1, {})
    assert response == {}

    out, err = capsys.readouterr()
    assert out == "Lambda warming event received, skipping handler\n"
    assert err == ""


def test_handler_custom_domain(mock_wsgi_app_file, mock_app, event_v1, wsgi_handler):
    event_v1["headers"]["Host"] = "custom.domain.com"
    wsgi_handler.handler(event_v1, {})

    assert wsgi_handler.wsgi_app.last_environ == {
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
        "QUERY_STRING": urlencode(event_v1["queryStringParameters"], doseq=True),
        "REMOTE_ADDR": "76.20.166.147",
        "REMOTE_USER": "wile_e_coyote",
        "REQUEST_METHOD": "GET",
        "SCRIPT_NAME": "",
        "SERVER_NAME": "custom.domain.com",
        "SERVER_PORT": "443",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.errors": wsgi_handler.wsgi_app.last_environ["wsgi.errors"],
        "wsgi.input": wsgi_handler.wsgi_app.last_environ["wsgi.input"],
        "wsgi.multiprocess": False,
        "wsgi.multithread": False,
        "wsgi.run_once": False,
        "wsgi.url_scheme": "https",
        "wsgi.version": (1, 0),
        "serverless.authorizer": {"principalId": "wile_e_coyote"},
        "serverless.context": {},
        "serverless.event": event_v1,
    }


def test_handler_api_gateway_base_path(
    mock_wsgi_app_file, mock_app, event_v1, wsgi_handler
):
    event_v1["headers"]["Host"] = "custom.domain.com"
    event_v1["path"] = "/prod/some/path"
    try:
        os.environ["API_GATEWAY_BASE_PATH"] = "prod"
        wsgi_handler.handler(event_v1, {})
    finally:
        del os.environ["API_GATEWAY_BASE_PATH"]

    assert wsgi_handler.wsgi_app.last_environ == {
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
        "QUERY_STRING": urlencode(event_v1["queryStringParameters"]),
        "REMOTE_ADDR": "76.20.166.147",
        "REMOTE_USER": "wile_e_coyote",
        "REQUEST_METHOD": "GET",
        "SCRIPT_NAME": "/prod",
        "SERVER_NAME": "custom.domain.com",
        "SERVER_PORT": "443",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.errors": wsgi_handler.wsgi_app.last_environ["wsgi.errors"],
        "wsgi.input": wsgi_handler.wsgi_app.last_environ["wsgi.input"],
        "wsgi.multiprocess": False,
        "wsgi.multithread": False,
        "wsgi.run_once": False,
        "wsgi.url_scheme": "https",
        "wsgi.version": (1, 0),
        "serverless.authorizer": {"principalId": "wile_e_coyote"},
        "serverless.context": {},
        "serverless.event": event_v1,
    }


def test_handler_strip_stage_path(mock_wsgi_app_file, mock_app, event_v1, wsgi_handler):
    try:
        os.environ["STRIP_STAGE_PATH"] = "True"
        wsgi_handler.handler(event_v1, {})
    finally:
        del os.environ["STRIP_STAGE_PATH"]

    assert wsgi_handler.wsgi_app.last_environ["SCRIPT_NAME"] == ""


def test_handler_base64(mock_wsgi_app_file, mock_app, event_v1, wsgi_handler):
    wsgi_handler.wsgi_app.cookie_count = 1
    wsgi_handler.wsgi_app.response_mimetype = "image/jpeg"
    response = wsgi_handler.handler(event_v1, {})

    assert response == {
        "body": "SGVsbG8gV29ybGQg4piDIQ==",
        "headers": {
            "Set-Cookie": "CUSTOMER=WILE_E_COYOTE; Path=/",
            "Content-Length": "16",
            "Content-Type": "image/jpeg",
        },
        "statusCode": 200,
        "isBase64Encoded": True,
    }


def test_handler_plain(mock_wsgi_app_file, mock_app, event_v1, wsgi_handler):
    wsgi_handler.wsgi_app.cookie_count = 1

    plain_mimetypes = [
        "application/vnd.api+json",
        "application/javascript; charset=utf-8",
        "image/svg+xml; charset=utf-8",
    ]

    for mimetype in plain_mimetypes:
        wsgi_handler.wsgi_app.response_mimetype = mimetype
        response = wsgi_handler.handler(event_v1, {})

        assert response == {
            "body": "Hello World ☃!",
            "headers": {
                "Set-Cookie": "CUSTOMER=WILE_E_COYOTE; Path=/",
                "Content-Length": "16",
                "Content-Type": mimetype,
            },
            "statusCode": 200,
            "isBase64Encoded": False,
        }


def test_handler_base64_request(mock_wsgi_app_file, mock_app, event_v1, wsgi_handler):
    event_v1["body"] = "SGVsbG8gd29ybGQ="
    event_v1["headers"]["Content-Type"] = "text/plain"
    event_v1["isBase64Encoded"] = True
    event_v1["httpMethod"] = "PUT"

    wsgi_handler.handler(event_v1, {})

    environ = wsgi_handler.wsgi_app.last_environ

    assert environ["CONTENT_TYPE"] == "text/plain"
    assert environ["CONTENT_LENGTH"] == "11"
    assert environ["REQUEST_METHOD"] == "PUT"
    assert environ["wsgi.input"].getvalue().decode() == "Hello world"


def test_non_package_subdir_app(mock_subdir_wsgi_app_file, mock_app, wsgi_handler):
    assert wsgi_handler.wsgi_app.module == "app"


def test_handler_binary_request_body(
    mock_wsgi_app_file, mock_app, event_v1, wsgi_handler
):
    event_v1["body"] = (
        "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5VTRDZE5CRWVLQWxIaGRRcQ0KQ29udGVu"
        "dC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJ3YXQiDQoNCmhleW9vb3Bw"
        "cHBwDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlVNENkTkJFZUtBbEhoZFFxDQpD"
        "b250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZpbGVUb1VwbG9h"
        "ZCI7IGZpbGVuYW1lPSJGRjREMDAtMC44LnBuZyINCkNvbnRlbnQtVHlwZTogaW1h"
        "Z2UvcG5nDQoNColQTkcNChoKAAAADUlIRFIAAAABAAAAAQEDAAAAJdtWygAAAANQ"
        "TFRF/00AXDU4fwAAAAF0Uk5TzNI0Vv0AAAAKSURBVHicY2IAAAAGAAM2N3yoAAAA"
        "AElFTkSuQmCCDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlVNENkTkJFZUtBbEho"
        "ZFFxDQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9InN1Ym1p"
        "dCINCg0KVXBsb2FkIEltYWdlDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlVNENk"
        "TkJFZUtBbEhoZFFxLS0NCg=="
    )
    event_v1["headers"][
        "Content-Type"
    ] = "multipart/form-data; boundary=----WebKitFormBoundaryU4CdNBEeKAlHhdQq"
    event_v1["isBase64Encoded"] = True
    event_v1["httpMethod"] = "POST"

    wsgi_handler.handler(event_v1, {})

    environ = wsgi_handler.wsgi_app.last_environ

    assert environ["CONTENT_LENGTH"] == "496"
    assert Request(environ).form["submit"] == "Upload Image"


def test_handler_request_body_undecodable_with_latin1(
    mock_wsgi_app_file, mock_app, event_v1, wsgi_handler
):
    event_v1["body"] = (
        "------WebKitFormBoundary3vA72kRLuq9D3NdL\r\n"
        u'Content-Disposition: form-data; name="text"\r\n\r\n'
        "テスト 테스트 测试\r\n"
        "------WebKitFormBoundary3vA72kRLuq9D3NdL--"
    )
    event_v1["headers"][
        "Content-Type"
    ] = "multipart/form-data; boundary=----WebKitFormBoundary3vA72kRLuq9D3NdL"
    event_v1["httpMethod"] = "POST"

    wsgi_handler.handler(event_v1, {})

    environ = wsgi_handler.wsgi_app.last_environ
    assert Request(environ).form["text"] == "テスト 테스트 测试"


def test_handler_custom_text_mime_types(
    mock_text_mime_wsgi_app_file, mock_app, event_v1, wsgi_handler
):
    wsgi_handler.wsgi_app.cookie_count = 1
    wsgi_handler.wsgi_app.response_mimetype = "application/custom+json"
    response = wsgi_handler.handler(event_v1, {})

    assert response == {
        "body": "Hello World ☃!",
        "headers": {
            "Set-Cookie": "CUSTOMER=WILE_E_COYOTE; Path=/",
            "Content-Length": "16",
            "Content-Type": "application/custom+json",
        },
        "statusCode": 200,
        "isBase64Encoded": False,
    }


def test_handler_alb(mock_wsgi_app_file, mock_app, wsgi_handler, elb_event):
    response = wsgi_handler.handler(elb_event, {})

    assert response == {
        "body": "Hello World ☃!",
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


def test_alb_query_params(mock_wsgi_app_file, mock_app, wsgi_handler, elb_event):
    elb_event["queryStringParameters"] = {"test": "test%20test"}
    response = wsgi_handler.handler(elb_event, {})
    query_string = wsgi_handler.wsgi_app.last_environ["QUERY_STRING"]
    assert query_string == "test=test+test"

    assert response == {
        "body": "Hello World ☃!",
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


def test_alb_multi_query_params(mock_wsgi_app_file, mock_app, wsgi_handler, elb_event):
    del elb_event["queryStringParameters"]
    elb_event["multiValueQueryStringParameters"] = {
        "%E6%B8%AC%E8%A9%A6": ["%E3%83%86%E3%82%B9%E3%83%88", "test"],
        "test": "test%20test",
    }
    response = wsgi_handler.handler(elb_event, {})
    query_string = wsgi_handler.wsgi_app.last_environ["QUERY_STRING"]
    assert query_string == urlencode(
        {"測試": ["テスト", "test"], "test": "test test"}, doseq=True)

    assert response == {
        "body": "Hello World ☃!",
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


def test_command_exec(mock_wsgi_app_file, mock_app, wsgi_handler):
    response = wsgi_handler.handler(
        {"_serverless-wsgi": {"command": "exec", "data": "print(1+4)"}}, {}
    )

    assert response[0] == 0
    assert response[1] == "5\n"

    response = wsgi_handler.handler(
        {"_serverless-wsgi": {"command": "exec", "data": "invalid code"}}, {}
    )

    assert response[0] == 1
    assert "Traceback (most recent call last):" in response[1]
    assert "SyntaxError: invalid syntax" in response[1]


def test_command_command(mock_wsgi_app_file, mock_app, wsgi_handler):
    response = wsgi_handler.handler(
        {"_serverless-wsgi": {"command": "command", "data": 'echo "hello world"'}}, {}
    )

    assert response[0] == 0
    assert response[1] == "hello world\n"

    response = wsgi_handler.handler(
        {
            "_serverless-wsgi": {
                "command": "command",
                "data": "ls non-existing-filename",
            }
        },
        {},
    )

    assert response[0] > 0
    assert "No such file or directory" in response[1]


def test_command_manage(mock_wsgi_app_file, mock_app, wsgi_handler):
    class MockObject:
        pass

    class MockDjango:
        def call_command(*args):
            print("Called with: {}".format(", ".join(args[1:])))

    sys.modules["django"] = MockObject()
    sys.modules["django.core"] = MockObject()
    sys.modules["django.core"].management = MockDjango()

    response = wsgi_handler.handler(
        {"_serverless-wsgi": {"command": "manage", "data": "check --list-tags"}}, {}
    )

    assert response[0] == 0
    assert response[1] == "Called with: check, --list-tags\n"


def test_command_flask(mock_wsgi_app_file, mock_app, wsgi_handler):
    class MockObject:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                self.__dict__[k] = v

    class MockFlaskGroup:
        def __init__(self, create_app):
            assert create_app() == mock_app

        def main(ctx, args, standalone_mode):
            assert not standalone_mode
            print("Called with: {}".format(", ".join(args)))

    sys.modules["flask"] = MockObject()
    sys.modules["flask.cli"] = MockObject(FlaskGroup=MockFlaskGroup)

    response = wsgi_handler.handler(
        {"_serverless-wsgi": {"command": "flask", "data": "custom command"}}, {}
    )

    assert response[0] == 0
    assert response[1] == "Called with: custom, command\n"


def test_command_unknown(mock_wsgi_app_file, mock_app, wsgi_handler):
    response = wsgi_handler.handler(
        {"_serverless-wsgi": {"command": "unknown", "data": 'echo "hello world"'}}, {}
    )

    assert response[0] == 1
    assert "Traceback (most recent call last):" in response[1]
    assert "Exception: Unknown command: unknown" in response[1]


def test_app_import_error(mock_wsgi_app_file, mock_app_with_import_error, event_v1, wsgi_handler):
    response = wsgi_handler.handler(event_v1, {})
    assert response == {
        "statusCode": 500,
        "body": "<!doctype html>\n<html lang=en>\n<title>500 Internal Server Error</title>\n<h1>Internal Server Error</h1>\n<p>Unable to import app: app.app</p>\n",
        "headers": {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Length": "140"
        },
        "isBase64Encoded": False
    }


def test_handler_with_encoded_characters_in_path(
    mock_wsgi_app_file, mock_app, event_v1, capsys, wsgi_handler
):
    event_v1["path"] = "/city/new%20york"
    wsgi_handler.handler(event_v1, {"memory_limit_in_mb": "128"})
    assert wsgi_handler.wsgi_app.last_environ["PATH_INFO"] == "/city/new york"


@pytest.fixture
def event_v2():
    return {
        "version": "2.0",
        "routeKey": "GET /some/path",
        "rawPath": "/some/path",
        "rawQueryString": "param1=value1&param2=value2&param2=value3",
        "cookies": ["CUSTOMER=WILE_E_COYOTE", "PART_NUMBER=ROCKET_LAUNCHER_0001"],
        "headers": {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate",
            "CloudFront-Forwarded-Proto": "https",
            "CloudFront-Is-Desktop-Viewer": "true",
            "CloudFront-Is-Mobile-Viewer": "false",
            "CloudFront-Is-SmartTV-Viewer": "false",
            "CloudFront-Is-Tablet-Viewer": "false",
            "CloudFront-Viewer-Country": "DK",
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
        "queryStringParameters": {"param1": "value1", "param2": "value2,value3"},
        "requestContext": {
            "accountId": "16794",
            "apiId": "3z6kd9fbb1",
            "authorizer": {"principalId": "wile_e_coyote"},
            "domainName": "id.execute-api.us-east-1.amazonaws.com",
            "domainPrefix": "id",
            "http": {
                "method": "GET",
                "path": "/some/path",
                "protocol": "HTTP/1.1",
                "sourceIp": "76.20.166.147",
                "userAgent": "agent",
            },
            "requestId": "ad2db740-10a2-11e7-8ced-35048084babb",
            "stage": "dev",
            "routeKey": "$default",
            "time": "12/Mar/2020:19:03:58 +0000",
            "timeEpoch": 1583348638390,
        },
        "pathParameters": {"proxy": "some/path"},
        "isBase64Encoded": False,
        "stageVariables": None,
    }


def test_handler_v2(mock_wsgi_app_file, mock_app, event_v2, capsys, wsgi_handler):
    response = wsgi_handler.handler(event_v2, {"memory_limit_in_mb": "128"})

    assert response == {
        "body": "Hello World ☃!",
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

    assert wsgi_handler.wsgi_app.last_environ == {
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
        "QUERY_STRING": "param1=value1&param2=value2&param2=value3",
        "REMOTE_ADDR": "76.20.166.147",
        "REMOTE_USER": "wile_e_coyote",
        "REQUEST_METHOD": "GET",
        "SCRIPT_NAME": "/dev",
        "SERVER_NAME": "3z6kd9fbb1.execute-api.us-east-1.amazonaws.com",
        "SERVER_PORT": "443",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.errors": wsgi_handler.wsgi_app.last_environ["wsgi.errors"],
        "wsgi.input": wsgi_handler.wsgi_app.last_environ["wsgi.input"],
        "wsgi.multiprocess": False,
        "wsgi.multithread": False,
        "wsgi.run_once": False,
        "wsgi.url_scheme": "https",
        "wsgi.version": (1, 0),
        "serverless.authorizer": {"principalId": "wile_e_coyote"},
        "serverless.context": {"memory_limit_in_mb": "128"},
        "serverless.event": event_v2,
    }

    out, err = capsys.readouterr()
    assert out == ""
    assert err == "application debug #1\n"


def test_handler_with_encoded_characters_in_path_v2(
    mock_wsgi_app_file, mock_app, event_v2, capsys, wsgi_handler
):
    event_v2["rawPath"] = "/city/new%20york"
    wsgi_handler.handler(event_v2, {"memory_limit_in_mb": "128"})
    assert wsgi_handler.wsgi_app.last_environ["PATH_INFO"] == "/city/new york"


@pytest.fixture
def event_lambda_integration():
    return {
        "body": {},
        "method": "GET",
        "principalId": "testuser",
        "stage": "dev",
        "cognitoPoolClaims": {"sub": ""},
        "enhancedAuthContext": {
            "principalId": "testuser",
            "integrationLatency": "1031",
            "contextTest": "123",
        },
        "headers": {
            "Accept": "*/*",
            "Authorization": "Bearer f14a720d62e1d1295d9",
            "CloudFront-Forwarded-Proto": "https",
            "CloudFront-Is-Desktop-Viewer": "true",
            "CloudFront-Is-Mobile-Viewer": "false",
            "CloudFront-Is-SmartTV-Viewer": "false",
            "CloudFront-Is-Tablet-Viewer": "false",
            "CloudFront-Viewer-Country": "FI",
            "Host": "k3k8rkx1mf.execute-api.us-east-1.amazonaws.com",
            "User-Agent": "curl/7.68.0",
            "Via": "2.0 3bf180720d62e0d1295d99086d103efb.cloudfront.net (CloudFront)",
            "X-Amz-Cf-Id": "9Z6K736EDx_vlsij1PA-ZVxIPPi-vAIMaLNOvJ2FrbpvGMisAISY8Q==",
            "X-Amzn-Trace-Id": "Root=1-5055b7d3-751afb497f81bab2759b6e7b",
            "X-Forwarded-For": "83.23.10.243, 130.166.149.164",
            "X-Forwarded-Port": "443",
            "X-Forwarded-Proto": "https",
        },
        "query": {"q": "test"},
        "path": {"p": "path2"},
        "identity": {
            "cognitoIdentityPoolId": "",
            "accountId": "",
            "cognitoIdentityId": "",
            "caller": "",
            "sourceIp": "83.23.100.243",
            "principalOrgId": "",
            "accessKey": "",
            "cognitoAuthenticationType": "",
            "cognitoAuthenticationProvider": "",
            "userArn": "",
            "userAgent": "curl/7.68.0",
            "user": "",
        },
        "stageVariables": {},
        "requestPath": "/some/{p}",
    }


def test_handler_lambda(
    mock_wsgi_app_file, mock_app, event_lambda_integration, capsys, wsgi_handler
):
    response = wsgi_handler.handler(
        event_lambda_integration, {"memory_limit_in_mb": "128"}
    )

    assert response == {
        "body": "Hello World ☃!",
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

    assert wsgi_handler.wsgi_app.last_environ == {
        "CONTENT_LENGTH": "0",
        "CONTENT_TYPE": "",
        "HTTP_ACCEPT": "*/*",
        "HTTP_AUTHORIZATION": "Bearer f14a720d62e1d1295d9",
        "HTTP_CLOUDFRONT_FORWARDED_PROTO": "https",
        "HTTP_CLOUDFRONT_IS_DESKTOP_VIEWER": "true",
        "HTTP_CLOUDFRONT_IS_MOBILE_VIEWER": "false",
        "HTTP_CLOUDFRONT_IS_SMARTTV_VIEWER": "false",
        "HTTP_CLOUDFRONT_IS_TABLET_VIEWER": "false",
        "HTTP_CLOUDFRONT_VIEWER_COUNTRY": "FI",
        "HTTP_HOST": "k3k8rkx1mf.execute-api.us-east-1.amazonaws.com",
        "HTTP_USER_AGENT": "curl/7.68.0",
        "HTTP_VIA": "2.0 3bf180720d62e0d1295d99086d103efb.cloudfront.net (CloudFront)",
        "HTTP_X_AMZN_TRACE_ID": "Root=1-5055b7d3-751afb497f81bab2759b6e7b",
        "HTTP_X_AMZ_CF_ID": "9Z6K736EDx_vlsij1PA-ZVxIPPi-vAIMaLNOvJ2FrbpvGMisAISY8Q==",
        "HTTP_X_FORWARDED_FOR": "83.23.10.243, 130.166.149.164",
        "HTTP_X_FORWARDED_PORT": "443",
        "HTTP_X_FORWARDED_PROTO": "https",
        "PATH_INFO": "/some/path2",
        "QUERY_STRING": "q=test",
        "REMOTE_ADDR": "83.23.100.243",
        "REMOTE_USER": "testuser",
        "REQUEST_METHOD": "GET",
        "SCRIPT_NAME": "/dev",
        "SERVER_NAME": "k3k8rkx1mf.execute-api.us-east-1.amazonaws.com",
        "SERVER_PORT": "443",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.errors": wsgi_handler.wsgi_app.last_environ["wsgi.errors"],
        "wsgi.input": wsgi_handler.wsgi_app.last_environ["wsgi.input"],
        "wsgi.multiprocess": False,
        "wsgi.multithread": False,
        "wsgi.run_once": False,
        "wsgi.url_scheme": "https",
        "wsgi.version": (1, 0),
        "serverless.authorizer": {
            "principalId": "testuser",
            "integrationLatency": "1031",
            "contextTest": "123",
        },
        "serverless.context": {"memory_limit_in_mb": "128"},
        "serverless.event": event_lambda_integration,
    }

    out, err = capsys.readouterr()
    assert out == ""
    assert err == "application debug #1\n"


def test_handler_lambda_error(
    mock_wsgi_app_file, mock_app, event_lambda_integration, capsys, wsgi_handler
):
    mock_app.status_code = 400
    with pytest.raises(Exception, match='"statusCode": 400'):
        wsgi_handler.handler(event_lambda_integration, {
                             "memory_limit_in_mb": "128"})
