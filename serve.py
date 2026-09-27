#!/usr/bin/env python3
"""Local portfolio server. Readers can open the site. Blog saves need the local key."""

import json
import os
import secrets
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
KEY_PATH = os.path.join(ROOT, "blog.key")
BLOGS_PATH = os.path.join(ROOT, "blogs.json")
MAX_BODY = 1_000_000
HIDDEN_EXACT = {"/blog.key", "/.gitignore", "/serve.py"}
HIDDEN_SUFFIXES = (".step", ".stl", ".pyc")


def load_key():
    if os.path.exists(KEY_PATH):
        with open(KEY_PATH, encoding="utf-8") as handle:
            return handle.read().strip()
    key = secrets.token_urlsafe(9)
    with open(KEY_PATH, "w", encoding="utf-8") as handle:
        handle.write(key + "\n")
    os.chmod(KEY_PATH, 0o600)
    return key


EDITOR_KEY = load_key()


def keys_match(given):
    if not given or not EDITOR_KEY:
        return False
    return secrets.compare_digest(given.encode(), EDITOR_KEY.encode())


def clean_posts(payload):
    if not isinstance(payload, list) or len(payload) > 100:
        raise ValueError("Posts must be a list of at most 100.")
    posts = []
    for item in payload:
        if not isinstance(item, dict):
            raise ValueError("Each post must be an object.")
        title = str(item.get("title", "")).strip()
        body = str(item.get("body", "")).strip()
        if not title or not body:
            raise ValueError("Each post needs a title and some text.")
        if len(title) > 160 or len(body) > 20000:
            raise ValueError("A post is too long.")
        posts.append(
            {
                "title": title,
                "body": body,
                "updated": str(item.get("updated", ""))[:40],
            }
        )
    return posts


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        blocked = (
            path in HIDDEN_EXACT
            or path.startswith("/.venv")
            or path.startswith("/.git")
            or path.lower().endswith(HIDDEN_SUFFIXES)
        )
        if blocked:
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/blogs.json":
            self.send_error(404)
            return
        if not keys_match(self.headers.get("X-Blog-Key", "")):
            self.send_error(403, "That key does not match.")
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > MAX_BODY:
            self.send_error(400, "Nothing to save.")
            return
        raw = self.rfile.read(length)
        try:
            posts = clean_posts(json.loads(raw.decode("utf-8")))
        except (ValueError, json.JSONDecodeError) as error:
            self.send_error(400, str(error))
            return
        temporary = BLOGS_PATH + ".tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            json.dump(posts, handle, indent=2)
            handle.write("\n")
        os.replace(temporary, BLOGS_PATH)
        body = json.dumps(posts).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 5220), Handler)
    print("Portfolio at http://127.0.0.1:5220/", flush=True)
    server.serve_forever()
