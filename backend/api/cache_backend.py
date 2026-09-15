"""Backend de caché resiliente a fallos de Redis.

RedisCache de Django no captura excepciones en las operaciones básicas
(get/set/incr...): si Redis está caído o rechaza la autenticación, la API
termina devolviendo 500 en los endpoints con throttle (login, register,
refresh, password reset) e incluso en el middleware de brute force.

ResilientRedisCache envuelve las operaciones en try/except y, si Redis
falla, delega en una LocMemCache del proceso (degradación controlada: sin
500, el rate limiting pasa a ser por proceso hasta que Redis vuelva).
"""
from django.core.cache.backends.locmem import LocMemCache
from django.core.cache.backends.redis import RedisCache


class ResilientRedisCache(RedisCache):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._fallback = LocMemCache('resilient-fallback', {})

    def get(self, *args, **kwargs):
        try:
            return super().get(*args, **kwargs)
        except Exception:
            return self._fallback.get(*args, **kwargs)

    def set(self, key, value, *args, **kwargs):
        try:
            return super().set(key, value, *args, **kwargs)
        except Exception:
            return self._fallback.set(key, value, *args, **kwargs)

    def add(self, *args, **kwargs):
        try:
            return super().add(*args, **kwargs)
        except Exception:
            return self._fallback.add(*args, **kwargs)

    def delete(self, *args, **kwargs):
        try:
            return super().delete(*args, **kwargs)
        except Exception:
            return self._fallback.delete(*args, **kwargs)

    def has_key(self, *args, **kwargs):
        try:
            return super().has_key(*args, **kwargs)
        except Exception:
            return self._fallback.has_key(*args, **kwargs)

    def incr(self, key, delta=1, *args, **kwargs):
        try:
            return super().incr(key, delta, *args, **kwargs)
        except Exception:
            return self._fallback.incr(key, delta, *args, **kwargs)

    def decr(self, key, delta=1, *args, **kwargs):
        try:
            return super().decr(key, delta, *args, **kwargs)
        except Exception:
            return self._fallback.decr(key, delta, *args, **kwargs)

    def get_many(self, *args, **kwargs):
        try:
            return super().get_many(*args, **kwargs)
        except Exception:
            return self._fallback.get_many(*args, **kwargs)

    def set_many(self, *args, **kwargs):
        try:
            return super().set_many(*args, **kwargs)
        except Exception:
            return self._fallback.set_many(*args, **kwargs)

    def delete_many(self, *args, **kwargs):
        try:
            return super().delete_many(*args, **kwargs)
        except Exception:
            return self._fallback.delete_many(*args, **kwargs)

    def clear(self, *args, **kwargs):
        try:
            return super().clear(*args, **kwargs)
        except Exception:
            return self._fallback.clear(*args, **kwargs)

    def touch(self, key, *args, **kwargs):
        try:
            return super().touch(key, *args, **kwargs)
        except Exception:
            return self._fallback.touch(key, *args, **kwargs)