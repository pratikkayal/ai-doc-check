# Databricks Integration Guide

## Overview

This application integrates with Databricks using the **OpenAI-compatible serving endpoints API** to perform AI-powered document verification.

---

## Architecture

### API Endpoint

```
https://dbc-2a72020b-a844.cloud.databricks.com/serving-endpoints/v1/chat/completions
```

### Model

```
databricks-gpt-oss-120b
```

### Authentication

- Uses Databricks Personal Access Token
- Token is entered by users via the login page
- Token is stored securely in encrypted session (iron-session)

---

## How It Works

### 1. Document Upload

User uploads a document (PDF/DOCX) which is saved to the server.

### 2. Processing

For each checklist item:

1. **Read Document Content**
   - Extract text from the uploaded document
   - Limit to first 10,000 characters for API efficiency

2. **Construct Prompt**
   - Create a detailed prompt asking the LLM to verify the checklist item
   - Include document content and verification criteria
   - Request JSON response format

3. **Call Databricks API**
   - Send POST request to serving endpoints
   - Use OpenAI-compatible chat completions format
   - Model: `databricks-gpt-oss-120b`
   - Temperature: 0.1 (for consistent results)

4. **Parse Response**
   - Extract LLM response from API
   - Parse JSON to get verification status
   - Fallback to text analysis if JSON parsing fails

5. **Return Result**
   - Status: verified or failed
   - Evidence: text description of findings
   - Confidence: 0-1 score
   - Reason: explanation of result

### 3. Display Results

Results are shown in real-time on the processing page and compiled into a final report.

---

## API Request Format

### Request

```typescript
{
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <DATABRICKS_TOKEN>',
    'Content-Type': 'application/json',
  },
  body: {
    model: 'databricks-gpt-oss-120b',
    messages: [
      {
        role: 'user',
        content: '<PROMPT>'
      }
    ],
    max_tokens: 5000,
    temperature: 0.1
  }
}
```

### Prompt Template

```
You are a document verification assistant. Analyze the following document and determine if it contains the required information.

Document Content:
<DOCUMENT_TEXT>

Verification Criteria:
<CHECKLIST_ITEM_DESCRIPTION>: <CHECKLIST_ITEM_CRITERIA>

Please respond in the following JSON format:
{
  "status": "verified" or "failed",
  "evidence_text": "specific text or description of what was found or missing",
  "confidence": a number between 0 and 1,
  "reason": "brief explanation of the verification result"
}

Only respond with the JSON object, no additional text.
```

### Response

```json
{
  "choices": [
    {
      "message": {
        "content": "{\"status\":\"verified\",\"evidence_text\":\"Contact information found: John Doe, john@example.com\",\"confidence\":0.95,\"reason\":\"All required fields present\"}"
      }
    }
  ]
}
```

---

## Implementation Details

### Code Location

**File:** `app/api/process/route.ts`

**Function:** `callRealDatabricksAPI()`

### Key Features

1. **Document Reading**
   ```typescript
   const fileBuffer = await readFile(documentPath);
   const documentContent = fileBuffer.toString('utf-8').substring(0, 10000);
   ```

2. **API Call**
   ```typescript
   const response = await fetch('https://dbc-2a72020b-a844.cloud.databricks.com/serving-endpoints/v1/chat/completions', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       model: 'databricks-gpt-oss-120b',
       messages: [{ role: 'user', content: prompt }],
       max_tokens: 5000,
       temperature: 0.1,
     }),
   });
   ```

3. **Response Parsing**
   ```typescript
   const llmResponse = data.choices?.[0]?.message?.content || '';
   const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
   const parsedResult = JSON.parse(jsonMatch[0]);
   ```

4. **Error Handling**
   - Network errors
   - API errors (4xx, 5xx)
   - JSON parsing errors
   - File reading errors
   - Fallback to text analysis if JSON parsing fails

---

## Configuration

### Environment Variables

**File:** `.env.local`

```bash
# API Mode (set to 'true' for production)
USE_REAL_API=false

# Databricks Token (entered via login page, not stored in .env)
DATABRICKS_TOKEN=

# Session Secret
SESSION_SECRET=your-secret-key-change-this-in-production
```

### Switching Modes

**Development (Simulated):**
```bash
USE_REAL_API=false
```

**Production (Real API):**
```bash
USE_REAL_API=true
```

---

## Testing

### Test Real API Mode

1. **Set Environment Variable**
   ```bash
   USE_REAL_API=true
   ```

2. **Restart Server**
   ```bash
   npm run dev
   ```

3. **Get Databricks Token**
   - Go to Databricks workspace
   - User Settings → Developer → Access Tokens
   - Generate new token

4. **Login**
   - Navigate to http://localhost:3000
   - Enter your Databricks token
   - Click "Validate & Continue"

5. **Upload Document**
   - Upload a resume or test document
   - Click "Process Document"

6. **Monitor Logs**
   - Check terminal for `[REAL API]` logs
   - Verify API calls are being made

7. **Review Results**
   - Check verification results
   - Verify they match document content

### Test Simulated Mode

1. **Set Environment Variable**
   ```bash
   USE_REAL_API=false
   ```

2. **Restart Server**
   ```bash
   npm run dev
   ```

3. **Upload Document**
   - Upload any document
   - Results will be random (70% pass rate)

4. **Monitor Logs**
   - Check terminal for `[SIMULATED API]` logs

---

## Troubleshooting

### Error: "Failed to parse URL"

**Cause:** `DATABRICKS_HOST` or `DATABRICKS_WAREHOUSE_ID` environment variables are set (old configuration)

**Solution:** Remove these variables from `.env.local`. The new implementation uses a hardcoded serving endpoint URL.

### Error: "Unauthorized" (401)

**Cause:** Invalid or expired Databricks token

**Solution:**
1. Generate a new token in Databricks workspace
2. Enter the new token on the login page
3. Ensure token has access to serving endpoints

### Error: "Model not found"

**Cause:** The model `databricks-gpt-oss-120b` is not available in your workspace

**Solution:**
1. Check available models in your Databricks workspace
2. Update the model name in `app/api/process/route.ts`
3. Restart the server

### Error: "Timeout"

**Cause:** API call taking too long

**Solution:**
1. Reduce document size (currently limited to 10k chars)
2. Reduce `max_tokens` in API call
3. Check Databricks workspace performance

### JSON Parsing Errors

**Cause:** LLM response is not valid JSON

**Solution:**
- The implementation has fallback text analysis
- Check terminal logs for raw LLM response
- Adjust prompt template for better JSON formatting
- Consider using a different model

---

## Performance Optimization

### Current Optimizations

1. **Document Truncation**
   - Limits document to first 10,000 characters
   - Reduces API payload size
   - Faster processing

2. **Low Temperature**
   - Temperature: 0.1
   - More consistent results
   - Better JSON formatting

3. **Efficient Prompting**
   - Clear, concise prompts
   - Specific JSON format request
   - Reduces token usage

### Future Optimizations

1. **Caching**
   - Cache document content
   - Cache API responses for duplicate requests

2. **Batch Processing**
   - Process multiple items in single API call
   - Reduce API overhead

3. **Streaming**
   - Use streaming API for real-time updates
   - Better user experience

4. **Document Chunking**
   - Split large documents into chunks
   - Process each chunk separately
   - Combine results

---

## Cost Considerations

### API Costs

- Databricks charges per token
- Each verification uses ~500-2000 tokens
- 8 checklist items = ~4000-16000 tokens per document

### Cost Reduction Strategies

1. **Use Simulated Mode for Development**
   - No API costs
   - Faster iteration

2. **Optimize Prompts**
   - Shorter prompts = fewer tokens
   - Clear instructions = better results

3. **Limit Document Size**
   - Currently limited to 10k chars
   - Adjust based on needs

4. **Cache Results**
   - Store verification results
   - Avoid re-processing same documents

---

## Security

### Token Storage

- Tokens are stored in encrypted session (iron-session)
- HTTP-only cookies
- Not stored in database or logs

### API Communication

- HTTPS only
- Bearer token authentication
- No sensitive data in URLs

### Best Practices

1. **Never commit tokens to git**
2. **Use environment-specific tokens**
3. **Rotate tokens regularly**
4. **Monitor API usage**
5. **Set up rate limiting**

---

## Migration from SQL Warehouse

### Old Approach (Removed)

```typescript
// OLD - SQL Warehouse API
const response = await fetch(`${process.env.DATABRICKS_HOST}/api/2.0/sql/statements`, {
  body: JSON.stringify({
    warehouse_id: process.env.DATABRICKS_WAREHOUSE_ID,
    statement: `SELECT verify_document('${documentPath}', '${checklistItem.criteria}')`,
  }),
});
```

### New Approach (Current)

```typescript
// NEW - OpenAI-compatible serving endpoints
const response = await fetch('https://dbc-2a72020b-a844.cloud.databricks.com/serving-endpoints/v1/chat/completions', {
  body: JSON.stringify({
    model: 'databricks-gpt-oss-120b',
    messages: [{ role: 'user', content: prompt }],
  }),
});
```

### Benefits of New Approach

✅ **Simpler** - No SQL required  
✅ **More Flexible** - LLM can understand natural language  
✅ **Better Results** - AI-powered analysis  
✅ **Standard API** - OpenAI-compatible format  
✅ **Easier Testing** - Can test with curl  

---

## Summary

| Aspect | Details |
|--------|---------|
| **API Type** | OpenAI-compatible serving endpoints |
| **Endpoint** | `https://dbc-2a72020b-a844.cloud.databricks.com/serving-endpoints/v1/chat/completions` |
| **Model** | `databricks-gpt-oss-120b` |
| **Authentication** | Bearer token (Personal Access Token) |
| **Request Format** | Chat completions (OpenAI-compatible) |
| **Response Format** | JSON with verification results |
| **Error Handling** | Comprehensive with fallbacks |
| **Cost** | Per-token pricing |
| **Performance** | ~1-3 seconds per item |

---

## Next Steps

1. **Test with Real Token** - Get a Databricks token and test real API mode
2. **Customize Prompts** - Adjust prompts for better verification results
3. **Monitor Usage** - Track API costs and performance
4. **Optimize** - Implement caching and batching if needed
5. **Deploy** - Set `USE_REAL_API=true` in production

For more details, see [API_MODE_CONFIGURATION.md](./API_MODE_CONFIGURATION.md).

