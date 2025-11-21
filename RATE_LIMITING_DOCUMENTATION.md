# Rate Limiting Implementation

## Overview
This document describes the rate limiting implementation for AI scan endpoints to prevent abuse and control costs.

## Implemented Rate Limits

### AI Scan Endpoint
- **Endpoint**: `POST /api/documents/:documentId/ai-scan`
- **Rate Limit**: 10 requests per minute per IP address
- **Response Code**: 429 (Too Many Requests)
- **Purpose**: Prevent spam of expensive AI operations (AWS Textract + OpenAI)

### Bulk AI Scan Endpoint
- **Endpoint**: `POST /api/documents/bulk-ai-scan`
- **Rate Limit**: 5 requests per minute per IP address (stricter)
- **Response Code**: 429 (Too Many Requests)
- **Purpose**: More aggressive limiting for batch operations

## Rate Limit Response

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": "Too many AI scan requests",
  "message": "You have exceeded the AI scan rate limit. Please try again in a minute.",
  "retryAfter": 60
}
```

### Response Headers
- `RateLimit-Limit`: Maximum number of requests allowed
- `RateLimit-Remaining`: Number of requests remaining in current window
- `RateLimit-Reset`: Timestamp when the rate limit resets

## Benefits

### Cost Control
- **Before**: Unlimited AI scans could drain credits and incur huge AWS/OpenAI costs
- **After**: Maximum 10-15 AI operations per minute, predictable cost ceiling

### Resource Protection
- Prevents AWS Textract overload
- Prevents OpenAI API rate limit errors
- Protects server resources from concurrent AI operations

### Security
- Prevents malicious spam attacks
- Protects against buggy client code
- Provides DoS protection for expensive endpoints

## Testing Rate Limiting

### Manual Test
```bash
# Test single AI scan rate limit (should fail after 10 requests)
for i in {1..15}; do
  echo "Request $i"
  curl -X POST \
    http://localhost:3000/api/documents/DOCUMENT_ID/ai-scan \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json"
  echo "\n"
done

# Test bulk AI scan rate limit (should fail after 5 requests)
for i in {1..8}; do
  echo "Request $i"
  curl -X POST \
    http://localhost:3000/api/documents/bulk-ai-scan \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"documentIds": ["ID1", "ID2"]}'
  echo "\n"
done
```

### Expected Behavior
1. First N requests succeed (10 for single, 5 for bulk)
2. Subsequent requests return 429 status
3. After 60 seconds, requests succeed again

## Configuration

Rate limits can be adjusted in `backend/src/middleware/rateLimitMiddleware.js`:

```javascript
// Single scan: 10 requests/minute
export const aiScanRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  // ...
});

// Bulk scan: 5 requests/minute
export const bulkAiScanRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  // ...
});
```

## Monitoring

Rate limit violations are logged:
```
[RATE LIMIT] AI scan rate limit exceeded for IP: 192.168.1.1
[RATE LIMIT] Bulk AI scan rate limit exceeded for IP: 192.168.1.1
```

Monitor these logs to:
- Detect abuse patterns
- Identify legitimate users hitting limits (may need adjustment)
- Track API usage patterns

## Production Considerations

### Behind Load Balancer
The rate limiter correctly identifies client IPs through proxy headers:
```javascript
keyGenerator: (req) => {
  return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}
```

### Adjusting Limits
If legitimate users frequently hit limits:
- Increase `max` value
- Increase `windowMs` (e.g., per 5 minutes instead of per minute)
- Consider per-user limits instead of per-IP

### Redis Integration (Future)
For distributed systems with multiple servers, consider using Redis for shared rate limit state:
```javascript
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL);

export const aiScanRateLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
  }),
  // ...
});
```

## Files Modified
- `backend/src/middleware/rateLimitMiddleware.js` - Rate limiter definitions
- `backend/src/routes/documentRoutes.js` - Applied rate limiters to routes
- `package.json` - Added express-rate-limit dependency

## Security Status
✅ Rate limiting implemented
✅ Cost control in place
✅ DoS protection active
✅ Monitoring and logging enabled
