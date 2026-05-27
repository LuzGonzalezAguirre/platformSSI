import environ
from .base import *

env = environ.Env()

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-secret-key-not-for-production")
DEBUG = True
ALLOWED_HOSTS = ["*"]

# Q-Wall: BD local SQL Server de inspecciones
QWALL_DB_CONN_STR = "SERVER=AAS-PAC-FTP01;DATABASE=CCS;Trusted_Connection=yes;"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="mes_db"),
        "USER": env("POSTGRES_USER", default="mes_user"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="mes_pass"),
        "HOST": env("DB_HOST", default="db"),
        "PORT": env("DB_PORT", default="5432"),
    }
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": env("REDIS_URL", default="redis://:mes_redis_pass@redis:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "KEY_PREFIX": "mes_dev",
    }
}

CELERY_BROKER_URL = env("REDIS_URL", default="redis://:mes_redis_pass@redis:6379/0")

CORS_ALLOW_ALL_ORIGINS = True


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {"handlers": ["console"], "level": "DEBUG"},
}