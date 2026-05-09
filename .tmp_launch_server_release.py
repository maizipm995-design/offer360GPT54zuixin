import paramiko

SCRIPT = """#!/usr/bin/env bash
set -euo pipefail
cd /srv/offer360/app

echo "[1/5] reinstall webhook service"
echo 'root123456@' | sudo -S env ENV_FILE=/srv/offer360/app/.env bash deploy/prod/scripts/install-webhook-service.sh

echo "[2/5] build api image"
docker build -f deploy/prod/dockerfiles/api.Dockerfile -t local/offer360/offer360-api:manual-20260510-ossfix .

echo "[3/5] build web image"
docker build -f deploy/prod/dockerfiles/web.Dockerfile -t local/offer360/offer360-web:manual-20260510-ossfix .

echo "[4/5] build wechat gateway image"
docker build -f deploy/prod/dockerfiles/wechat-pay-gateway.Dockerfile -t local/offer360/offer360-wechat-pay-gateway:manual-20260510-ossfix .

echo "[5/5] release"
IMAGE_REGISTRY=local IMAGE_NAMESPACE=offer360 SKIP_PULL=1 ENV_FILE=/srv/offer360/app/.env APP_IMAGE_TAG=manual-20260510-ossfix bash deploy/prod/scripts/deploy-release.sh
"""


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect("175.24.133.232", username="ubuntu", password="root123456@", timeout=20)
    sftp = ssh.open_sftp()
    with sftp.open("/tmp/manual-release-current.sh", "w") as f:
        f.write(SCRIPT)
    sftp.close()

    commands = [
        "chmod +x /tmp/manual-release-current.sh",
        "rm -f /tmp/manual-release-current.log /tmp/manual-release-current.exit",
        "nohup bash /tmp/manual-release-current.sh >/tmp/manual-release-current.log 2>&1; echo $? >/tmp/manual-release-current.exit &",
        "echo launched",
    ]
    for cmd in commands:
        _, out, err = ssh.exec_command(cmd, timeout=30)
        print(out.read().decode("utf-8", "ignore"))
        print(err.read().decode("utf-8", "ignore"))
    ssh.close()


if __name__ == "__main__":
    main()
