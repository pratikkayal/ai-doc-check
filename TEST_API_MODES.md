# Testing API Modes

This guide shows you how to test both simulated and real API modes.

## Current Configuration

Check your current mode:

```bash
cat .env.local | grep USE_REAL_API
```

## Test 1: Simulated Mode (Default)

### Setup

1. Ensure `.env.local` has:
   ```bash
   USE_REAL_API=false
   ```

2. Restart the development server:
   ```bash
   # Press Ctrl+C to stop
   npm run dev
   ```

### Test Steps

1. Navigate to http://localhost:3000
2. Enter any token (e.g., "test-token-123")
3. Upload a resume PDF
4. Click "Process Document"
5. **Watch the terminal logs** - you should see:
   ```
   [SIMULATED API] Processing item 1: Contact Information
   [SIMULATED API] Processing item 2: Professional Summary
   [SIMULATED API] Processing item 3: Work Experience Section
   ...
   ```

### Expected Behavior

- ✅ Logs show `[SIMULATED API]` prefix
- ✅ Processing takes 8-12 seconds (0.5-1.5s per item)
- ✅ Results are random (70% pass rate)
- ✅ No actual API calls made
- ✅ Works without Databricks credentials

### Example Terminal Output

```
GET /api/process?filename=resume.pdf&documentPath=/path/to/resume.pdf 200 in 9758ms
```

Notice the processing time is around 8-10 seconds for 8 items.

---

## Test 2: Real API Mode

### Setup

1. Update `.env.local`:
   ```bash
   USE_REAL_API=true
   DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
   DATABRICKS_WAREHOUSE_ID=your-warehouse-id
   ```

2. Restart the development server:
   ```bash
   # Press Ctrl+C to stop
   npm run dev
   ```

### Test Steps

1. Navigate to http://localhost:3000
2. Enter a **valid Databricks Personal Access Token**
3. Upload a resume PDF
4. Click "Process Document"
5. **Watch the terminal logs** - you should see:
   ```
   [REAL API] Processing item 1: Contact Information
   [REAL API] Processing item 2: Professional Summary
   [REAL API] Processing item 3: Work Experience Section
   ...
   ```

### Expected Behavior

- ✅ Logs show `[REAL API]` prefix
- ✅ Processing time depends on Databricks response
- ✅ Results based on actual document content
- ✅ Actual HTTP requests to Databricks API
- ✅ Requires valid credentials

### Example Terminal Output

```
[REAL API] Processing item 1: Contact Information
[REAL API] Processing item 2: Professional Summary
GET /api/process?filename=resume.pdf&documentPath=/path/to/resume.pdf 200 in 15234ms
```

Processing time will vary based on Databricks API response time.

---

## Comparing the Modes

### Side-by-Side Comparison

| Aspect | Simulated Mode | Real API Mode |
|--------|---------------|---------------|
| **Terminal Logs** | `[SIMULATED API]` | `[REAL API]` |
| **Processing Time** | 8-12 seconds | Varies (depends on API) |
| **Results** | Random (70% pass) | Based on document |
| **Credentials** | Not required | Required |
| **API Calls** | None | Yes (to Databricks) |
| **Cost** | Free | Databricks charges apply |

### Visual Indicators

**Simulated Mode Terminal:**
```bash
[SIMULATED API] Processing item 1: Contact Information
[SIMULATED API] Processing item 2: Professional Summary
[SIMULATED API] Processing item 3: Work Experience Section
[SIMULATED API] Processing item 4: Education History
[SIMULATED API] Processing item 5: Skills Section
[SIMULATED API] Processing item 6: Professional Formatting
[SIMULATED API] Processing item 7: Quantifiable Achievements
[SIMULATED API] Processing item 8: Certifications or Additional Sections
GET /api/process?filename=resume.pdf 200 in 9758ms
```

**Real API Mode Terminal:**
```bash
[REAL API] Processing item 1: Contact Information
[REAL API] Processing item 2: Professional Summary
[REAL API] Processing item 3: Work Experience Section
[REAL API] Processing item 4: Education History
[REAL API] Processing item 5: Skills Section
[REAL API] Processing item 6: Professional Formatting
[REAL API] Processing item 7: Quantifiable Achievements
[REAL API] Processing item 8: Certifications or Additional Sections
GET /api/process?filename=resume.pdf 200 in 15234ms
```

---

## Troubleshooting

### Mode Not Switching

**Problem:** Changed `USE_REAL_API` but still seeing old mode in logs

**Solution:**
1. Stop the server (Ctrl+C)
2. Verify `.env.local` has correct value
3. Restart server: `npm run dev`
4. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
5. Upload a new document and check terminal logs

### Real API Errors

**Problem:** Set `USE_REAL_API=true` but getting errors

**Check:**
1. Is the Databricks token valid?
2. Does the token have access to serving endpoints?
3. Is the serving endpoint URL correct for your workspace?
4. Can you access Databricks API from your network?

**Test Databricks Connection:**
```bash
curl -X POST "https://dbc-2a72020b-a844.cloud.databricks.com/serving-endpoints/v1/chat/completions" \
  -H "Authorization: Bearer ${YOUR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "databricks-gpt-oss-120b",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

### No Logs Appearing

**Problem:** Not seeing `[SIMULATED API]` or `[REAL API]` in terminal

**Solution:**
1. Make sure you're looking at the terminal running `npm run dev`
2. Upload and process a document
3. Logs appear during processing, not before
4. Check that the processing page is actually calling the API

---

## Quick Switch Commands

### Switch to Simulated Mode

```bash
# Update .env.local
echo "USE_REAL_API=false" > .env.local.tmp
cat .env.local | grep -v USE_REAL_API >> .env.local.tmp
mv .env.local.tmp .env.local

# Restart server
# Press Ctrl+C, then:
npm run dev
```

### Switch to Real API Mode

```bash
# Update .env.local
echo "USE_REAL_API=true" > .env.local.tmp
cat .env.local | grep -v USE_REAL_API >> .env.local.tmp
mv .env.local.tmp .env.local

# Restart server
# Press Ctrl+C, then:
npm run dev
```

---

## Automated Testing

### Test Script

Create a test script to verify both modes:

```bash
#!/bin/bash

echo "Testing API Modes..."

# Test Simulated Mode
echo "USE_REAL_API=false" > .env.local
npm run dev &
SERVER_PID=$!
sleep 5

echo "Testing simulated mode..."
curl -X POST http://localhost:3000/api/validate-token \
  -H "Content-Type: application/json" \
  -d '{"token":"test-token"}'

# Check logs for [SIMULATED API]
# ... add your test logic here ...

kill $SERVER_PID

# Test Real API Mode (if credentials available)
if [ -n "$DATABRICKS_HOST" ]; then
  echo "USE_REAL_API=true" > .env.local
  npm run dev &
  SERVER_PID=$!
  sleep 5
  
  echo "Testing real API mode..."
  # ... add your test logic here ...
  
  kill $SERVER_PID
fi

echo "Tests complete!"
```

---

## Best Practices

### Development Workflow

1. **Start with Simulated Mode**
   - Develop and test UI/UX
   - Test error handling
   - Verify export functionality

2. **Switch to Real API for Integration Testing**
   - Test with actual Databricks
   - Verify API response parsing
   - Test with real documents

3. **Back to Simulated for Demos**
   - No API costs
   - Predictable results
   - Faster processing

### Production Deployment

1. Set `USE_REAL_API=true` in production environment
2. Use environment-specific `.env` files
3. Monitor API usage and costs
4. Set up error logging and alerting

---

## Summary

✅ **Simulated Mode** - Perfect for development and testing  
✅ **Real API Mode** - Required for production use  
✅ **Easy Switching** - Just change one environment variable  
✅ **Clear Logging** - Terminal shows which mode is active  
✅ **No Code Changes** - Switch modes without modifying code  

For more details, see [API_MODE_CONFIGURATION.md](./API_MODE_CONFIGURATION.md).

