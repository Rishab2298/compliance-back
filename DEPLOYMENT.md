# Deployment Guide for System Monitoring

## Production Setup

### Prerequisites
- Node.js v20+ installed
- PM2 installed globally (`npm install -g pm2`)
- PostgreSQL database
- SSL certificates (if using HTTPS)
- Redis (optional but recommended for metrics persistence)

### Step 1: Install Dependencies

```bash
cd /path/to/backend
npm install --production
```

### Step 2: Database Setup

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

### Step 3: Configure Environment

Create/update `.env` file:

```env
NODE_ENV=production
PORT=5003
DATABASE_URL="postgresql://user:password@localhost:5432/logilink"
CLERK_SECRET_KEY="sk_live_..."
CLERK_WEBHOOK_SECRET="whsec_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
VITE_API_URL="https://yourdomain.com"
```

### Step 4: Start with PM2

```bash
# Start the application
pm2 start ecosystem.config.js --env production

# Save the process list
pm2 save

# Enable auto-restart on server reboot
pm2 startup
# Follow the command it prints
```

### Step 5: Verify Deployment

```bash
# Check if running
pm2 list

# View logs
pm2 logs logilink-api

# Monitor resources
pm2 monit

# Check health endpoint
curl https://yourdomain.com/api/health
```

## Monitoring in Production

### PM2 Built-in Monitoring

PM2 provides built-in monitoring:

```bash
# Real-time monitoring
pm2 monit

# Process details
pm2 describe logilink-api

# View metrics
pm2 show logilink-api
```

### System Metrics Dashboard

Access your custom metrics dashboard at:
```
https://yourdomain.com/super-admin/system-logs
```

Login as SUPER_ADMIN to view:
- Server uptime and health
- CPU and memory usage
- Request/response metrics
- Error tracking
- Endpoint performance

### Log Rotation

PM2 handles log rotation. Configure in `ecosystem.config.js`:

```javascript
{
  max_size: '10M',           // Rotate when log reaches 10MB
  max_files: 10,             // Keep 10 log files
  compress: true,            // Compress rotated logs
  rotateInterval: '1d'       // Rotate daily
}
```

## Important Notes for Production

### 1. Memory Usage
Current setup uses **in-memory metrics storage**:
- ✅ Works for single instance
- ❌ Metrics lost on restart
- ❌ Doesn't work in cluster mode

**Solution for high-traffic production:**
- Use Redis for shared metrics storage
- Or use PM2 Plus (paid APM service)

### 2. Error Tracking
For production-grade error tracking, consider:
- **Sentry** - Full error tracking with stack traces
- **LogRocket** - Session replay + monitoring
- **Datadog** - Comprehensive APM

### 3. Cluster Mode
For high availability, use cluster mode:

```javascript
// ecosystem.config.js
{
  instances: 'max',  // 1 per CPU core
  exec_mode: 'cluster'
}
```

⚠️ **Note:** If using cluster mode, implement Redis-based metrics storage!

### 4. Health Checks
Monitor health endpoint for automated alerts:

```bash
# Set up monitoring service (e.g., UptimeRobot, Pingdom)
# Ping: https://yourdomain.com/api/health
# Alert if status !== "healthy"
```

### 5. Backup and Recovery
Ensure automated backups:
- Database backups (daily)
- Environment files backup
- SSL certificates backup

## Troubleshooting

### Server Not Starting

```bash
# Check PM2 logs
pm2 logs logilink-api --err

# Check if port is in use
lsof -i :5003

# Restart PM2
pm2 restart logilink-api
```

### High Memory Usage

```bash
# Check current memory
pm2 describe logilink-api

# If using cluster mode, reduce instances
pm2 scale logilink-api 2  # Scale to 2 instances

# Or restart the app to clear memory
pm2 restart logilink-api
```

### Database Connection Issues

```bash
# Test database connection
npx prisma studio

# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test with psql
psql $DATABASE_URL
```

## Monitoring Checklist

- [ ] PM2 running and saved
- [ ] Health endpoint returns 200
- [ ] Database connected
- [ ] Logs directory created and writable
- [ ] SSL certificates valid and not expiring
- [ ] Error tracking initialized
- [ ] Metrics collecting properly
- [ ] Cron jobs running (reminders)
- [ ] Auto-restart on server reboot enabled

## Updates and Maintenance

### Deploy New Version

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Run migrations if any
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Restart with zero downtime (cluster mode)
pm2 reload logilink-api

# Or restart normally
pm2 restart logilink-api
```

### View Metrics Over Time

PM2 stores metrics history. View with:

```bash
pm2 plus  # Sign up for PM2 Plus (optional paid service)
```

Or use custom dashboard at `/super-admin/system-logs`

## Security Considerations

1. **Never commit `.env` files** to git
2. **Rotate secrets regularly** (Clerk, Stripe keys)
3. **Keep SSL certificates updated**
4. **Monitor for suspicious activity** in logs
5. **Enable rate limiting** for public endpoints
6. **Regular security audits** (`npm audit`)

## Support

For issues:
1. Check PM2 logs: `pm2 logs logilink-api`
2. Check system metrics dashboard
3. Review error tracking in Sentry (if configured)
4. Check health endpoint status
