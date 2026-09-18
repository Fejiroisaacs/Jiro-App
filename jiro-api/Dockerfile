# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o jiro-api ./cmd/server

# Runtime stage
FROM alpine:3.22

RUN apk --no-cache add ca-certificates

# Run as an unprivileged user: any RCE in the API then starts as uid 10001
# rather than root.
RUN adduser -D -u 10001 -h /app app

WORKDIR /app

COPY --from=builder --chown=app:app /app/jiro-api .
COPY --from=builder --chown=app:app /app/migrations ./migrations

USER app

EXPOSE 8080

CMD ["./jiro-api"]
