import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

setuptools.setup(
    name="serverless-wsgi",
    version="1.6.0",
    author="Logan Raarup",
    author_email="logan@logan.dk",
    description="Amazon AWS API Gateway WSGI wrapper",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/logandk/serverless-wsgi",
    py_modules=["serverless_wsgi"],
    install_requires=["werkzeug"],
    classifiers=(
        "Development Status :: 5 - Production/Stable",
        "Programming Language :: Python :: 2",
        "Programming Language :: Python :: 3",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ),
    keywords="wsgi serverless aws lambda api gateway apigw flask django pyramid",
)
