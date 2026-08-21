#!/bin/zsh

cd "/Users/s2/Documents/Codex/2026-08-19/w/icongen" || exit 1

export PATH="/Users/s2/.nvm/versions/node/v24.15.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
export NO_PROXY="localhost,127.0.0.1"
export no_proxy="localhost,127.0.0.1"

echo "正在启动 Bamboo IconGen 验收环境……"
echo "启动完成后请访问：http://127.0.0.1:3000"
echo "请保持此窗口打开。"
echo

"/Users/s2/.nvm/versions/node/v24.15.0/bin/npm" exec --workspace=@icongen/web -- next dev --webpack -H 127.0.0.1 -p 3000

status=$?
echo
echo "服务已停止，退出码：$status"
echo "请保留此窗口并将上方报错截图发给我。"
read "?按回车键关闭窗口……"
