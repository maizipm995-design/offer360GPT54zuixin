FROM golang:1.22-alpine AS builder
WORKDIR /app
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn
COPY apps/wechat-pay-gateway/go.mod ./go.mod
COPY apps/wechat-pay-gateway/go.sum ./go.sum
RUN go mod download
COPY apps/wechat-pay-gateway/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/wechat-pay-gateway ./main.go

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates && adduser -D app
COPY --from=builder /out/wechat-pay-gateway /usr/local/bin/wechat-pay-gateway
USER app
EXPOSE 8080
CMD ["wechat-pay-gateway"]
