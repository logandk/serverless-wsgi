#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
This module converts an AWS API Gateway proxied request to a WSGI request.

Inspired by: https://github.com/miserlou/zappa

Author: Logan Raarup <logan@logan.dk>
"""
import base64
import os
import sys
from werkzeug.datastructures import Headers
from werkzeug.wrappers import Response
from werkzeug.urls import url_encode
from werkzeug.http import HTTP_STATUS_CODES
from werkzeug._compat import BytesIO, string_types, to_bytes, wsgi_encoding_dance

# List of MIME types that should not be base64 encoded. MIME types within `text/*`
# are included by default.
TEXT_MIME_TYPES = [
    "application/json",
    "application/javascript",
    "application/xml",
    "application/vnd.api+json",
    "image/svg+xml",
]


def all_casings(input_string):
    """
    Permute all casings of a given string.
    A pretty algoritm, via @Amber
    http://stackoverflow.com/questions/6792803/finding-all-possible-case-permutations-in-python
    """
    if not input_string:
        yield ""
    else:
        first = input_string[:1]
        if first.lower() == first.upper():
            for sub_casing in all_casings(input_string[1:]):
                yield first + sub_casing
        else:
            for sub_casing in all_casings(input_string[1:]):
                yield first.lower() + sub_casing
                yield first.upper() + sub_casing


def handle_request(app, event, context):
    if event.get("source") in ["aws.events", "serverless-plugin-warmup"]:
        return {}

    headers = Headers(event[u"headers"])

    if u"amazonaws.com" in headers.get(u"Host", u""):
        script_name = "/{}".format(event[u"requestContext"].get(u"stage", ""))
    else:
        script_name = ""

    # If a user is using a custom domain on API Gateway, they may have a base
    # path in their URL. This allows us to strip it out via an optional
    # environment variable.
    path_info = event[u"path"]
    base_path = os.environ.get("API_GATEWAY_BASE_PATH", "")
    if base_path:
        script_name = "/" + base_path

        if path_info.startswith(script_name):
            path_info = path_info[len(script_name) :]

    body = event[u"body"] or ""
    if event.get("isBase64Encoded", False):
        body = base64.b64decode(body)
    if isinstance(body, string_types):
        body = to_bytes(body, charset="utf-8")

    environ = {
        "API_GATEWAY_AUTHORIZER": event[u"requestContext"].get(u"authorizer"),
        "CONTENT_LENGTH": str(len(body)),
        "CONTENT_TYPE": headers.get(u"Content-Type", ""),
        "PATH_INFO": path_info,
        "QUERY_STRING": url_encode(event.get(u"queryStringParameters") or {}),
        "REMOTE_ADDR": event[u"requestContext"]
        .get(u"identity", {})
        .get(u"sourceIp", ""),
        "REMOTE_USER": event[u"requestContext"]
        .get(u"authorizer", {})
        .get(u"principalId", ""),
        "REQUEST_METHOD": event[u"httpMethod"],
        "SCRIPT_NAME": script_name,
        "SERVER_NAME": headers.get(u"Host", "lambda"),
        "SERVER_PORT": headers.get(u"X-Forwarded-Port", "80"),
        "SERVER_PROTOCOL": "HTTP/1.1",
        "event": event,
        "context": context,
        "wsgi.errors": sys.stderr,
        "wsgi.input": BytesIO(body),
        "wsgi.multiprocess": False,
        "wsgi.multithread": False,
        "wsgi.run_once": False,
        "wsgi.url_scheme": headers.get(u"X-Forwarded-Proto", "http"),
        "wsgi.version": (1, 0),
    }

    for key, value in environ.items():
        if isinstance(value, string_types):
            environ[key] = wsgi_encoding_dance(value)

    for key, value in headers.items():
        key = "HTTP_" + key.upper().replace("-", "_")
        if key not in ("HTTP_CONTENT_TYPE", "HTTP_CONTENT_LENGTH"):
            environ[key] = value

    response = Response.from_app(app, environ)

    # If there are multiple Set-Cookie headers, create case-mutated variations
    # in order to pass them through APIGW. This is a hack that's currently
    # needed. See: https://github.com/logandk/serverless-wsgi/issues/11
    # Source: https://github.com/Miserlou/Zappa/blob/master/zappa/middleware.py
    new_headers = [x for x in response.headers if x[0] != "Set-Cookie"]
    cookie_headers = [x for x in response.headers if x[0] == "Set-Cookie"]
    if len(cookie_headers) > 1:
        for header, new_name in zip(cookie_headers, all_casings("Set-Cookie")):
            new_headers.append((new_name, header[1]))
    elif len(cookie_headers) == 1:
        new_headers.extend(cookie_headers)

    returndict = {u"statusCode": response.status_code, u"headers": dict(new_headers)}

    if event.get("requestContext").get("elb"):
        # If the request comes from ALB we need to add a status description
        returndict["statusDescription"] = u"%d %s" % (
            response.status_code,
            HTTP_STATUS_CODES[response.status_code],
        )

    if response.data:
        mimetype = response.mimetype or "text/plain"
        if (
            mimetype.startswith("text/") or mimetype in TEXT_MIME_TYPES
        ) and not response.headers.get("Content-Encoding", ""):
            returndict["body"] = response.get_data(as_text=True)
            returndict["isBase64Encoded"] = False
        else:
            returndict["body"] = base64.b64encode(response.data).decode("utf-8")
            returndict["isBase64Encoded"] = True

    return returndict
