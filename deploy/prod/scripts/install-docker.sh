#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 root 或 sudo 执行该脚本。"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release

install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.asc ]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
cat >/etc/apt/sources.list.d/docker.list <<EOF
deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin nginx

systemctl enable docker
systemctl restart docker
systemctl enable nginx
systemctl restart nginx

if id -nG ubuntu 2>/dev/null | grep -qw docker; then
  :
elif id ubuntu >/dev/null 2>&1; then
  usermod -aG docker ubuntu
fi

cat <<'EOF'
Docker 与 Nginx 安装完成：
- 已安装 Docker Engine / Buildx / Compose Plugin / Nginx
- 已尝试将 ubuntu 用户加入 docker 组
- 宿主机反向代理将由 Nginx 统一接管 80/443
- 若当前 SSH 会话仍无法直接执行 docker，请重新登录一次服务器
EOF
