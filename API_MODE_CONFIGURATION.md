# API Mode Configuration Guide

## Overview

The Document Verification System supports two modes of operation:
1. **Simulated Mode** (Default) - Uses fake/random responses for testing and development
2. **Real API Mode** - Makes actual calls to Databricks API for production use

This is controlled by the `USE_REAL_API` environment variable.

---

## Environment Variable

### `USE_REAL_API`

**Location:** `.env.local`

**Values:**
- `false` (default) - Use simulated/fake API responses
- `true` - Use real Databricks API calls

**Example:**
```bash
# For development/testing (simulated responses)
USE_REAL_API=false

# For production (real Databricks API)
USE_REAL_API=true
```

---

## Simulated Mode (Default)

### When to Use
- ✅ Development and testing
- ✅ Demo purposes
- ✅ When you don't have Databricks credentials
- ✅ Quick prototyping
- ✅ UI/UX testing

### Behavior
- Generates random verification results (70% pass rate)
- Simulates processing delay (500ms - 1.5s per item)
- Creates fake evidence with random page numbers and confidence scores
- No external API calls made
- No Databricks credentials required

### Configuration
```bash
# .env.local
USE_REAL_API=false
# or leave empty/unset (defaults to false)
```

### Example Output
```json
{
  "itemId": 1,
  "status": "verified",
  "evidence": {
    "text": "Found: Contact Information - Verified",
    "pageNumber": 3,
    "coordinates": { "x": 234.5, "y": 456.7, "width": 200, "height": 50 },
    "confidence": 0.92
  },
  "reason": "Criteria met"
}
```

### Advantages
- ⚡ Fast setup - no configuration needed
- 💰 No API costs
- 🔒 No credentials required
- 🧪 Predictable testing environment
- 🚀 Works offline

### Limitations
- ❌ Results are random, not based on actual document content
- ❌ Cannot verify real documents accurately
- ❌ Not suitable for production use

---

## Real API Mode

### When to Use
- ✅ Production deployment
- ✅ Actual document verification
- ✅ When you have Databricks credentials
- ✅ Integration testing with real AI models
- ✅ Accurate verification results needed

### Behavior
- Makes actual HTTP requests to Databricks API
- Uses your Databricks SQL Warehouse or ML Model endpoint
- Returns real verification results based on document analysis
- Requires valid Databricks credentials
- Processing time depends on Databricks response time

### Configuration

**Step 1: Set Environment Variables**
```bash
# .env.local
USE_REAL_API=true
```

**Step 2: Ensure Databricks Token is Valid**
- Users must enter a valid Databricks Personal Access Token on the login page
- Token is stored securely in encrypted session
- Token must have access to the Databricks serving endpoints

**Step 3: Restart Development Server**
```bash
npm run dev
```

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `USE_REAL_API` | Enable real API mode | `true` |
| `DATABRICKS_TOKEN` | Your Databricks Personal Access Token | Entered via login page |

### Example Output
```json
{
  "itemId": 1,
  "status": "verified",
  "evidence": {
    "text": "Contact information found: John Doe, john@example.com, (555) 123-4567",
    "pageNumber": 1,
    "coordinates": { "x": 100, "y": 50, "width": 400, "height": 80 },
    "confidence": 0.95
  },
  "reason": "All required contact fields present"
}
```

### Advantages
- ✅ Accurate verification based on actual document content
- ✅ Production-ready
- ✅ Leverages Databricks AI/ML capabilities
- ✅ Real confidence scores
- ✅ Actual evidence extraction

### Limitations
- 💰 Incurs Databricks API costs
- 🔑 Requires valid credentials
- ⏱️ Slower than simulated mode (depends on API response time)
- 🌐 Requires internet connection
- ⚙️ Requires Databricks setup and configuration

---

## Implementation Details

### Code Structure

The processing API (`/app/api/process/route.ts`) contains three functions:

1. **`callRealDatabricksAPI()`** - Makes actual Databricks API calls
2. **`callSimulatedAPI()`** - Generates fake responses
3. **`callDatabricksAPI()`** - Routes to real or simulated based on `USE_REAL_API`

### Routing Logic

```typescript
async function callDatabricksAPI(
  token: string,
  documentPath: string,
  checklistItem: any
): Promise<VerificationResult> {
  const useRealAPI = process.env.USE_REAL_API === 'true';
  
  if (useRealAPI) {
    console.log(`[REAL API] Processing item ${checklistItem.id}`);
    return callRealDatabricksAPI(token, documentPath, checklistItem);
  } else {
    console.log(`[SIMULATED API] Processing item ${checklistItem.id}`);
    return callSimulatedAPI(token, documentPath, checklistItem);
  }
}
```

### Logging

The system logs which mode is being used:

**Simulated Mode:**
```
[SIMULATED API] Processing item 1: Contact Information
[SIMULATED API] Processing item 2: Professional Summary
...
```

**Real API Mode:**
```
[REAL API] Processing item 1: Contact Information
[REAL API] Processing item 2: Professional Summary
...
```

Check your terminal running `npm run dev` to see these logs.

---

## Switching Between Modes

### Development → Production

1. Update `.env.local`:
   ```bash
   USE_REAL_API=true
   DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
   DATABRICKS_WAREHOUSE_ID=your-warehouse-id
   ```

2. Restart server:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

3. Test with a document to verify real API is working

### Production → Development

1. Update `.env.local`:
   ```bash
   USE_REAL_API=false
   ```

2. Restart server:
   ```bash
   npm run dev
   ```

3. Simulated mode is now active

---

## Testing Both Modes

### Test Simulated Mode

```bash
# .env.local
USE_REAL_API=false
```

1. Upload a document
2. Check terminal logs for `[SIMULATED API]`
3. Verify results are random
4. Processing should take 8-12 seconds

### Test Real API Mode

```bash
# .env.local
USE_REAL_API=true
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_WAREHOUSE_ID=your-warehouse-id
```

1. Upload a document
2. Check terminal logs for `[REAL API]`
3. Verify results are based on actual document content
4. Processing time depends on Databricks response

---

## Databricks API Integration

### OpenAI-Compatible Serving Endpoints

The real API implementation uses Databricks serving endpoints with OpenAI-compatible API:

```typescript
const response = await fetch('https://dbc-2a72020b-a844.cloud.databricks.com/serving-endpoints/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'databricks-gpt-oss-120b',
    messages: [
      {
        role: 'user',
        content: `Analyze this document and verify if it contains: ${checklistItem.criteria}`
      }
    ],
    max_tokens: 5000,
    temperature: 0.1,
  }),
});
```

### Expected Response Format

The LLM should return JSON in this format:

```json
{
  "status": "verified",
  "evidence_text": "Contact information found: John Doe, john@example.com, (555) 123-4567",
  "confidence": 0.95,
  "reason": "All required contact fields present"
}
```

### Customizing the Integration

To customize for your Databricks setup, edit `/app/api/process/route.ts`:

1. Update the serving endpoint URL if using a different workspace
2. Modify the model name if using a different model
3. Adjust the prompt template for better verification results
4. Customize the response parsing logic
5. Add error handling specific to your setup

---

## Error Handling

### Real API Mode Errors

If the real API call fails:
- Error is logged to console
- Returns a "failed" result with error message
- Processing continues with next item
- User sees failed status in UI

Example error result:
```json
{
  "itemId": 1,
  "status": "failed",
  "evidence": {
    "text": "API call failed",
    "pageNumber": 1,
    "confidence": 0
  },
  "reason": "Databricks API error: Unauthorized"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Unauthorized` | Invalid token | Check Databricks token |
| `Not Found` | Invalid warehouse ID | Verify `DATABRICKS_WAREHOUSE_ID` |
| `Timeout` | Slow response | Increase `wait_timeout` |
| `Network error` | No internet | Check connection |

---

## Best Practices

### Development
- ✅ Use simulated mode (`USE_REAL_API=false`)
- ✅ Test UI/UX without API costs
- ✅ Use real mode only for integration testing

### Staging
- ✅ Use real mode with test Databricks workspace
- ✅ Test with sample documents
- ✅ Verify error handling

### Production
- ✅ Use real mode (`USE_REAL_API=true`)
- ✅ Monitor API costs
- ✅ Set up proper error logging
- ✅ Configure rate limiting if needed

---

## Monitoring

### Check Current Mode

Look at server logs when processing a document:
```bash
# Terminal output
[SIMULATED API] Processing item 1: Contact Information
# or
[REAL API] Processing item 1: Contact Information
```

### Verify Configuration

```bash
# Check .env.local
cat .env.local | grep USE_REAL_API

# Should output:
USE_REAL_API=false  # or true
```

---

## Troubleshooting

### Mode Not Switching

**Problem:** Changed `USE_REAL_API` but still seeing old mode

**Solution:**
1. Restart development server (Ctrl+C, then `npm run dev`)
2. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
3. Check `.env.local` has correct value

### Real API Not Working

**Problem:** Set `USE_REAL_API=true` but getting errors

**Solution:**
1. Check Databricks token is valid and has access to serving endpoints
2. Verify the serving endpoint URL is correct for your workspace
3. Test Databricks API with curl:
   ```bash
   curl -X POST "https://dbc-2a72020b-a844.cloud.databricks.com/serving-endpoints/v1/chat/completions" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "databricks-gpt-oss-120b",
       "messages": [{"role": "user", "content": "Hello"}],
       "max_tokens": 100
     }'
   ```

### Simulated Mode Too Slow/Fast

**Problem:** Want to adjust simulated processing time

**Solution:**
Edit `/app/api/process/route.ts`, line ~71:
```typescript
// Current: 500ms to 1.5s
await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

// Faster: 100ms to 500ms
await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));

// Slower: 1s to 3s
await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
```

---

## Summary

| Feature | Simulated Mode | Real API Mode |
|---------|---------------|---------------|
| **Environment Variable** | `USE_REAL_API=false` | `USE_REAL_API=true` |
| **Credentials Required** | No | Yes |
| **API Costs** | None | Yes |
| **Accuracy** | Random (70% pass) | Based on actual document |
| **Speed** | Fast (0.5-1.5s/item) | Varies (depends on API) |
| **Use Case** | Development/Testing | Production |
| **Setup Complexity** | Easy | Moderate |
| **Internet Required** | No | Yes |

---

## Next Steps

1. **For Development:** Keep `USE_REAL_API=false` and continue building features
2. **For Production:** Set up Databricks, configure environment variables, and switch to `USE_REAL_API=true`
3. **For Testing:** Test both modes to ensure smooth transition

For more details on Databricks integration, see `IMPLEMENTATION_GUIDE.md`.

