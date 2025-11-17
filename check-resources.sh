#!/bin/bash
# Check Lightsail resource usage
# Run: ssh bitnami@15.222.57.72 'bash -s' < check-resources.sh

echo "=== LIGHTSAIL RESOURCE USAGE ==="
echo ""

echo "📊 CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print "  Usage: " 100-$8 "%"}'
echo ""

echo "💾 Memory Usage:"
free -h | awk 'NR==2{printf "  Used: %s / %s (%.1f%%)\n", $3, $2, $3*100/$2}'
echo ""

echo "💿 Disk Usage:"
df -h / | awk 'NR==2{printf "  Used: %s / %s (%s)\n", $3, $2, $5}'
echo ""

echo "🔥 PM2 Process:"
pm2 describe compliance-backend | grep -E "cpu|memory" | awk '{printf "  %s\n", $0}'
echo ""

echo "📈 Database Connections:"
cd /opt/bitnami/apache/htdocs/compliance-back
echo "SELECT count(*) as active_connections FROM pg_stat_activity WHERE datname = 'postgres';" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>/dev/null || echo "  (Unable to check - RDS might be sleeping)"
echo ""

echo "🌐 Network Usage (today):"
vnstat -d | tail -5
