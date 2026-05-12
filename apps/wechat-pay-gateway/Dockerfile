ARG GO_BASE_IMAGE=golang:1.22-alpine
ARG ALPINE_BASE_IMAGE=alpine:3.20

FROM ${GO_BASE_IMAGE} AS builder
WORKDIR /app
ENV CGO_ENABLED=0
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/wechat-pay-gateway ./main.go

FROM ${ALPINE_BASE_IMAGE} AS runner
WORKDIR /app
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories && \
    apk add --no-cache ca-certificates && adduser -D -H -u 10001 app
COPY --from=builder /out/wechat-pay-gateway /usr/local/bin/wechat-pay-gateway
USER app
EXPOSE 8080
CMD ["wechat-pay-gateway"]
