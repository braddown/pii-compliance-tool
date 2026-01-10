# Omnipii Cloud Infrastructure

Self-hosted Supabase deployment on Kamatera for Omnipii Cloud.

## Overview

This setup provides:
- PostgreSQL 15 database
- PostgREST for RESTful API
- GoTrue for authentication
- Kong for API gateway and rate limiting
- Nginx for SSL termination and routing

## Prerequisites

- Kamatera server (Ubuntu 22.04 recommended)
- Docker and Docker Compose
- Domain: api.omnipii.com
- SSL certificates (via Let's Encrypt)

## Quick Start

### 1. Provision Server

Recommended specs:
- 4 vCPU
- 8GB RAM
- 100GB SSD
- Ubuntu 22.04 LTS

### 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Clone Repository

```bash
git clone https://github.com/braddown/pii-compliance-tool.git
cd pii-compliance-tool/infrastructure
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
nano .env
```

Generate secrets:
```bash
# JWT Secret
openssl rand -base64 32

# Postgres Password
openssl rand -base64 24
```

### 5. Configure DNS

Add A records:
- `api.omnipii.com` → Server IP
- `app.omnipii.com` → Server IP (optional, for dashboard)

### 6. Obtain SSL Certificates

```bash
# Install certbot
sudo apt install certbot

# Create webroot directory
mkdir -p html

# Get certificates (after DNS propagation)
sudo certbot certonly --webroot -w ./html -d api.omnipii.com

# Copy certificates
sudo mkdir -p certs
sudo cp /etc/letsencrypt/live/api.omnipii.com/fullchain.pem certs/
sudo cp /etc/letsencrypt/live/api.omnipii.com/privkey.pem certs/
sudo chown -R $USER:$USER certs
```

### 7. Start Services

```bash
docker compose up -d
```

### 8. Run Migrations

```bash
# Copy migrations to container
docker cp ../migrations omnipii-db:/migrations

# Run migrations
for f in 001 002 003 004 005 006 007; do
  docker exec -i omnipii-db psql -U postgres -d omnipii < ../migrations/${f}_*.sql
done
```

### 9. Verify

```bash
# Check health
curl https://api.omnipii.com/health

# Check services
docker compose ps
```

## Architecture

```
Internet
    │
    ▼
┌─────────────┐
│   Nginx     │ ← SSL termination, routing
│   (443)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Kong     │ ← Rate limiting, API keys
│   (8000)    │
└──────┬──────┘
       │
    ┌──┴───┐
    ▼      ▼
┌──────┐ ┌──────┐
│ REST │ │ Auth │
│(3000)│ │(9999)│
└──┬───┘ └──┬───┘
   │        │
   ▼        ▼
┌─────────────┐
│ PostgreSQL  │
│   (5432)    │
└─────────────┘
```

## Management

### View Logs

```bash
docker compose logs -f
docker compose logs -f rest
docker compose logs -f db
```

### Restart Services

```bash
docker compose restart
docker compose restart kong
```

### Database Access

```bash
docker exec -it omnipii-db psql -U postgres -d omnipii
```

### Backup Database

```bash
docker exec omnipii-db pg_dump -U postgres omnipii > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
docker exec -i omnipii-db psql -U postgres -d omnipii < backup.sql
```

## Monitoring

### Health Endpoints

- `https://api.omnipii.com/health` - Nginx health
- `https://api.omnipii.com/v1/health` - API health (via Kong)

### Metrics

Consider adding:
- Prometheus for metrics collection
- Grafana for dashboards
- AlertManager for alerts

## Security

### Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### SSL Renewal

```bash
# Add to crontab
0 0 1 * * certbot renew --quiet && docker compose restart nginx
```

## Troubleshooting

### Database Connection Failed

```bash
# Check database logs
docker compose logs db

# Verify database is healthy
docker exec omnipii-db pg_isready -U postgres
```

### API Returns 502

```bash
# Check PostgREST
docker compose logs rest

# Restart PostgREST
docker compose restart rest
```

### Rate Limiting Issues

```bash
# Check Kong logs
docker compose logs kong

# Verify Kong config
docker exec omnipii-kong kong config parse /kong/kong.yml
```
