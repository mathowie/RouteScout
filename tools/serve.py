#!/usr/bin/env python3
"""Serve the Route Scout shell and optionally a private route on local loopback."""
import argparse
import functools
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def __init__(self, *args, route, **kwargs):
        self.route = route
        super().__init__(*args, directory=str(ROOT / "dist"), **kwargs)

    def end_headers(self):
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
            "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",
        )
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def list_directory(self, _path):
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def send_head(self):
        # Reject foreign Host headers so other websites can't reach the local route via DNS rebinding.
        if self.headers.get("Host") not in (f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"):
            self.send_error(HTTPStatus.FORBIDDEN)
            return None
        if self.path.split("?", 1)[0] == "/__local-route.json":
            if not self.route or not self.route.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return None
            try:
                stream = self.route.open("rb")
            except OSError:
                self.send_error(HTTPStatus.NOT_FOUND)
                return None
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return stream
        return super().send_head()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4173)
    candidates = sorted((ROOT / "private").glob("*.route.json"))
    parser.add_argument("--route", type=Path, default=candidates[0] if len(candidates) == 1 else None)
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), functools.partial(Handler, route=args.route)) as server:
        url = f"http://127.0.0.1:{server.server_port}/"
        print(f"Local: {url}?local=1" if args.route and args.route.is_file() else f"Local: {url}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
