FROM golang:1.22-alpine AS builder
WORKDIR /app
ENV CGO_ENABLED=0
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/wechat-pay-gateway ./main.go

FROM alpine:3.20 AS runner
WORKDIR /app
RUN apk add --no-cache ca-certificates && adduser -D -H -u 10001 app
COPY --from=builder /out/wechat-pay-gateway /usr/local/bin/wechat-pay-gateway
USER app
EXPOSE 8080
CMD ["wechat-pay-gateway"]
