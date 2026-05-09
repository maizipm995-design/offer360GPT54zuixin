#!/usr/bin/env python3
import hashlib
import hmac
import json
import os
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

HOST = os.getenv("WEBHOOK_HOST", "0.0.0.0")
PORT = int(os.getenv("WEBHOOK_PORT", "19090"))
SECRET = os.getenv("WEBHOOK_SECRET", "")
TARGET_BRANCH = os.getenv("TARGET_BRANCH", "main")
PROJECT_ROOT = os.getenv("PROJECT_ROOT", "/opt/offer360")
ENV_FILE = os.getenv("ENV_FILE", f"{PROJECT_ROOT}/.env")
DEPLOY_SCRIPT = os.getenv("DEPLOY_SCRIPT", f"{PROJECT_ROOT}/deploy/prod/scripts/webhook-deploy.sh")
LOG_FILE = os.getenv("WEBHOOK_DEPLOY_LOG", f"{PROJECT_ROOT}/deploy/prod/runtime/logs/webhook-deploy.log")


def verify_signature(body: bytes, signature: str) -> bool:
    if not SECRET:
        return True
    if not signature.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/webhook/github":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length)
        signature = self.headers.get("X-Hub-Signature-256", "")
        event = self.headers.get("X-GitHub-Event", "")

        if not verify_signature(body, signature):
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"invalid signature")
            return

        if event != "push":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ignored")
            return

        payload = json.loads(body.decode("utf-8"))
        ref = payload.get("ref", "")
        if ref != f"refs/heads/{TARGET_BRANCH}":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ignored branch")
            return

        app_image_tag = payload.get("after", "")[:12] or "manual"
        env = os.environ.copy()
        env["APP_IMAGE_TAG"] = app_image_tag
        env["TARGET_BRANCH"] = TARGET_BRANCH
        env["PROJECT_ROOT"] = PROJECT_ROOT
        env["ENV_FILE"] = ENV_FILE
        env["WEBHOOK_DEPLOY_LOG"] = LOG_FILE

        log_path = Path(LOG_FILE)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        with log_path.open("ab") as log_file:
            log_file.write(
                f"\n=== webhook deploy start branch={TARGET_BRANCH} commit={app_image_tag} ===\n".encode("utf-8")
            )
            subprocess.Popen(
                ["bash", DEPLOY_SCRIPT],
                cwd=PROJECT_ROOT,
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT,
            )

        self.send_response(202)
        self.end_headers()
        self.wfile.write(b"deploy started")

    def log_message(self, format: str, *args):
        return


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), Handler)
    server.serve_forever()
