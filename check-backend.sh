#!/bin/bash

# Quick Backend Health Check Script
# Usage: ./check-backend.sh [production|local]

ENVIRONMENT=${1:-production}

if [ "$ENVIRONMENT" = "production" ]; then
    URL="https://zionlabs.co.in"
    echo "🔍 Checking PRODUCTION backend..."
elif [ "$ENVIRONMENT" = "local" ]; then
    URL="http://localhost:5003"
    echo "🔍 Checking LOCAL backend..."
else
    echo "Usage: $0 [production|local]"
    exit 1
fi

# Check if backend is responding
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Backend is UP (HTTP $HTTP_CODE)"

    # Check response time
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$URL")
    echo "⏱️  Response time: ${RESPONSE_TIME}s"

    # Check if SSL is working (production only)
    if [ "$ENVIRONMENT" = "production" ]; then
        SSL_EXPIRY=$(curl -vI "$URL" 2>&1 | grep "expire date" | cut -d':' -f2-)
        echo "🔒 SSL expires:$SSL_EXPIRY"
    fi

    exit 0
else
    echo "❌ Backend is DOWN or unreachable (HTTP $HTTP_CODE)"
    echo "🔧 Troubleshooting steps:"
    echo "   1. Check PM2 status: ssh user@server 'pm2 list'"
    echo "   2. Check logs: ssh user@server 'pm2 logs compliance-backend'"
    echo "   3. Check server: ssh user@server"
    exit 1
fi
