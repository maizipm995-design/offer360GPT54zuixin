import os
import posixpath

import paramiko

HOST = "175.24.133.232"
USER = "ubuntu"
PASS = "root123456@"
ROOT = "/Users/maizim/Documents/2605GPT54offer360"
REMOTE_ROOT = "/srv/offer360/app"

FILES = [
    "apps/api/src/modules/storage/storage.service.ts",
    "apps/web/lib/oss.ts",
    "deploy/prod/scripts/install-webhook-service.sh",
    "deploy/prod/scripts/webhook-deploy.sh",
    ".env.example",
    "docs/GitHub-Webhook自动部署与数据库增量规范.md",
]


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_dir: str):
    current = ""
    for part in remote_dir.strip("/").split("/"):
        current += "/" + part
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "ignore"), err.read().decode("utf-8", "ignore")


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, timeout=20)
    sftp = ssh.open_sftp()

    for rel in FILES:
      local_path = os.path.join(ROOT, rel)
      remote_path = posixpath.join(REMOTE_ROOT, *rel.split("/"))
      ensure_remote_dir(sftp, posixpath.dirname(remote_path))
      sftp.put(local_path, remote_path)
      print(f"uploaded: {rel}")

    sftp.close()

    commands = [
        f"cd {REMOTE_ROOT} && if grep -q '^GITHUB_REPO_SLUG=' .env; then sed -i 's#^GITHUB_REPO_SLUG=.*#GITHUB_REPO_SLUG=maizipm995-design/offer360GPT54zuixin#' .env; else echo 'GITHUB_REPO_SLUG=maizipm995-design/offer360GPT54zuixin' >> .env; fi",
        f"cd {REMOTE_ROOT} && if grep -q '^WEBHOOK_PORT=' .env; then true; else echo 'WEBHOOK_PORT=19090' >> .env; fi",
        f"cd {REMOTE_ROOT} && grep -n 'GITHUB_REPO_SLUG' .env .env.example deploy/prod/scripts/webhook-deploy.sh deploy/prod/scripts/install-webhook-service.sh || true",
        f"cd {REMOTE_ROOT} && grep -n 'static.offer360.cn' apps/api/src/modules/storage/storage.service.ts apps/web/lib/oss.ts || true",
    ]
    for cmd in commands:
        out, err = run(ssh, cmd)
        print(f'CMD>> {cmd}')
        if out:
            print(out.strip())
        if err:
            print(err.strip())

    ssh.close()


if __name__ == "__main__":
    main()
