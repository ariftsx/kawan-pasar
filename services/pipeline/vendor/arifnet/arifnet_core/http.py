"""Klien HTTP dengan retry, backoff eksponensial, dan penantian saat internet terputus.

Perilaku:
  * Galat koneksi (internet mati, DNS gagal, timeout): klien menunggu sambil memeriksa konektivitas, dengan jeda
    yang membesar sampai `backoff.max_seconds`, lalu mengulang request yang SAMA. Batas total penantian per request
    diatur `ARIFNET_NET_MAX_WAIT_MIN` (bawaan 360 menit). Request tidak pernah dilewati diam-diam.
  * HTTP 429 dan 5xx: diulang `retries` kali dengan jeda membesar (menghormati header Retry-After).
  * HTTP lain (200, 3xx, 4xx): dikembalikan apa adanya; pemanggil yang memutuskan.
  * Mengembalikan None hanya bila semua percobaan habis; pemanggil mencatatnya sebagai belum selesai.
"""
from __future__ import annotations

import logging
import random
import time

import requests

from . import settings

log = logging.getLogger("http")


class HTTPClient:
    def __init__(self, delay: float = 1.0, retries: int = 4, timeout: int = 45):
        cfg = settings.http_config()
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": settings.user_agent(),
                                     "Accept-Language": cfg.get("accept_language", "id-ID,id;q=0.9")})
        self.delay = delay * settings.http_delay_scale()
        self.retries = retries
        self.timeout = timeout
        b = cfg.get("backoff", {})
        self.base = float(b.get("base_seconds", 10))
        self.cap = float(b.get("max_seconds", 300))
        self.server_base = float(b.get("server_error_base_seconds", 30))
        self.probes = cfg.get("connectivity_probe_urls", [])

    # ──────────────────────────────── konektivitas
    def online(self) -> bool:
        for url in self.probes:
            try:
                requests.head(url, timeout=10, allow_redirects=False)
                return True
            except requests.RequestException:
                continue
        return not self.probes

    def wait_online(self, label: str = "") -> bool:
        """Tunggu sampai internet kembali; False bila melewati batas penantian."""
        deadline = time.time() + settings.network_max_wait_minutes() * 60
        pause = self.base
        while time.time() < deadline:
            if self.online():
                return True
            log.warning("%s internet terputus, cek lagi dalam %.0f s", label, pause)
            time.sleep(pause)
            pause = min(self.cap, pause * 2)
        return False

    # ──────────────────────────────── request
    def get(self, url: str, params: dict | None = None, label: str = "") -> requests.Response | None:
        server_attempt = 0
        net_deadline = time.time() + settings.network_max_wait_minutes() * 60
        net_pause = self.base
        while True:
            try:
                r = self.session.get(url, params=params, timeout=self.timeout)
            except requests.RequestException as exc:
                # URL cacat (tanpa schema, format salah) tidak akan sembuh dengan retry
                if isinstance(exc, (requests.exceptions.MissingSchema,
                                    requests.exceptions.InvalidSchema,
                                    requests.exceptions.InvalidURL)):
                    log.error("%s URL tidak valid (%s): %s", label, type(exc).__name__, exc)
                    return None
                if time.time() > net_deadline:
                    log.error("%s gagal terhubung melewati batas penantian: %s", label, exc)
                    return None
                log.warning("%s koneksi gagal (%s); menunggu jaringan", label, type(exc).__name__)
                time.sleep(net_pause)
                net_pause = min(self.cap, net_pause * 2)
                if not self.online() and not self.wait_online(label):
                    return None
                continue
            time.sleep(self.delay)
            if r.status_code == 429 or r.status_code >= 500:
                server_attempt += 1
                if server_attempt >= self.retries:
                    log.error("%s HTTP %s setelah %s percobaan", label, r.status_code, server_attempt)
                    return None
                wait = _retry_after(r) or min(self.cap, self.server_base * 2 ** (server_attempt - 1))
                wait += random.uniform(0, 3)
                log.warning("%s HTTP %s (%s/%s) -> tunggu %.0f s", label, r.status_code, server_attempt,
                            self.retries, wait)
                time.sleep(wait)
                continue
            return r


def _retry_after(r: requests.Response) -> float | None:
    value = r.headers.get("Retry-After")
    if not value:
        return None
    try:
        return min(3600.0, float(value))
    except ValueError:
        return None
