# 公司版镜像
#
# 为什么这样写：官方 Dockerfile 是多阶段构建，要从 docker.io 拉 golang/bun 基础镜像，
# 本机网络拉不动（EOF）。这里换一种做法——用官方成品镜像做底座，只把重新编译的
# 二进制覆盖进去。
#
# 前置步骤（在仓库根执行）：
#   1. cd web && bun run build                     生成带新配色的前端 dist
#   2. cd .. && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "-s -w" -o company/new-api-linux .
#
# 构建（在仓库根执行）：
#   docker build -f company/Dockerfile -t company-newapi:0.3.0 -t company-newapi:latest .
#
# 好处：不需要联网拉基础镜像；镜像里的运行环境（时区、CA、tini 等）与官方完全一致。

FROM calciumion/new-api:latest

# 官方镜像的入口就是 /new-api，这里直接替换成我们编译的版本
COPY company/new-api-linux /new-api

RUN chmod +x /new-api

# 沿用官方设置
WORKDIR /data
ENTRYPOINT ["/new-api"]
