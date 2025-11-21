#!/bin/bash

# Automated Backend Monitoring Script with Alerts
# Usage: Run this in cron every 5 minutes
# Crontab: */5 * * * * /path/to/monitor-backend.sh

# Configuration
BACKEND_URL="https://zionlabs.co.in"
ALERT_EMAIL="your-email@example.com"  # CHANGE THIS
SLACK_WEBHOOK=""  # Optional: Add Slack webhook URL
LOG_FILE="/tmp/backend-monitor.log"
STATE_FILE="/tmp/backend-state"
MAX_RESPONSE_TIME=5  # seconds

# Initialize state file if it doesn't exist
if [ ! -f "$STATE_FILE" ]; then
    echo "UP" > "$STATE_FILE"
fi

PREVIOUS_STATE=$(cat "$STATE_FILE")
CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S')

# Check backend health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BACKEND_URL")
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$BACKEND_URL")

# Determine current state
if [ "$HTTP_CODE" = "200" ] && (( $(echo "$RESPONSE_TIME < $MAX_RESPONSE_TIME" | bc -l) )); then
    CURRENT_STATE="UP"
    STATUS_MSG="✅ Backend is UP (HTTP $HTTP_CODE, ${RESPONSE_TIME}s)"
elif [ "$HTTP_CODE" = "200" ]; then
    CURRENT_STATE="SLOW"
    STATUS_MSG="⚠️  Backend is SLOW (HTTP $HTTP_CODE, ${RESPONSE_TIME}s)"
else
    CURRENT_STATE="DOWN"
    STATUS_MSG="❌ Backend is DOWN (HTTP $HTTP_CODE)"
fi

# Log status
echo "[$CURRENT_TIME] $STATUS_MSG" >> "$LOG_FILE"

# Send alert if state changed
if [ "$CURRENT_STATE" != "$PREVIOUS_STATE" ]; then
    ALERT_SUBJECT="🚨 LogiLink Backend Alert: $CURRENT_STATE"
    ALERT_BODY="Backend status changed from $PREVIOUS_STATE to $CURRENT_STATE

Time: $CURRENT_TIME
URL: $BACKEND_URL
HTTP Status: $HTTP_CODE
Response Time: ${RESPONSE_TIME}s

Previous State: $PREVIOUS_STATE
Current State: $CURRENT_STATE

---
Last 10 log entries:
$(tail -n 10 "$LOG_FILE")
"

    # Send email alert (requires mailx or sendmail)
    if command -v mail &> /dev/null; then
        echo "$ALERT_BODY" | mail -s "$ALERT_SUBJECT" "$ALERT_EMAIL"
    fi

    # Send Slack alert (optional)
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$ALERT_SUBJECT\n\`\`\`$ALERT_BODY\`\`\`\"}" \
            "$SLACK_WEBHOOK" &> /dev/null
    fi

    # Log state change
    echo "[$CURRENT_TIME] STATE CHANGE: $PREVIOUS_STATE -> $CURRENT_STATE" >> "$LOG_FILE"
fi

# Update state file
echo "$CURRENT_STATE" > "$STATE_FILE"

# Keep log file size manageable (last 1000 lines)
if [ $(wc -l < "$LOG_FILE") -gt 1000 ]; then
    tail -n 1000 "$LOG_FILE" > "${LOG_FILE}.tmp"
    mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

# Exit with error code if backend is down
if [ "$CURRENT_STATE" = "DOWN" ]; then
    exit 1
fi

exit 0
