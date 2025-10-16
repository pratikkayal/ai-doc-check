# Troubleshooting Guide

## Common Issues and Solutions

### Processing Page Issues

#### Issue: Processing stuck at high percentage (>100%)
**Symptoms:**
- Progress shows 538% or other high values
- Processing runs for 10+ minutes
- Multiple API calls in server logs

**Cause:** The useEffect hook was creating multiple EventSource connections due to dependency issues.

**Solution:**
1. **Refresh your browser** (hard refresh: Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. Clear browser cache if needed
3. Go back to dashboard and upload a new document
4. The fix has been applied - processing should now complete in 8-12 seconds

**What was fixed:**
- Removed problematic dependencies from useEffect
- Added cleanup to prevent multiple connections
- Reduced simulated processing time from 1-3s to 0.5-1.5s per item

---

#### Issue: Processing never completes
**Symptoms:**
- Progress bar stuck at a certain percentage
- No redirect to report page
- Console shows EventSource errors

**Solution:**
1. Check browser console (F12) for errors
2. Verify the uploaded file exists in `/uploads` directory
3. Check server logs for API errors
4. Ensure session is still valid (token not expired)

---

### Upload Issues

#### Issue: File upload fails
**Symptoms:**
- "File upload failed" error message
- File not appearing in dashboard

**Possible Causes & Solutions:**

1. **File too large**
   - Max size: 10MB
   - Solution: Compress or use a smaller file

2. **Invalid file type**
   - Supported: PDF, DOCX only
   - Solution: Convert file to supported format

3. **Permissions error**
   - Solution: Check that `uploads/` directory exists and is writable
   ```bash
   mkdir -p uploads
   chmod 755 uploads
   ```

---

### Authentication Issues

#### Issue: "Unauthorized" error
**Symptoms:**
- Redirected to login page
- API calls return 401 status

**Solutions:**
1. Re-enter your Databricks token on the home page
2. Check that SESSION_SECRET is set in `.env.local`
3. Clear cookies and re-authenticate
4. Verify token is valid in Databricks console

---

### CSS/Styling Issues

#### Issue: Page looks broken or unstyled
**Symptoms:**
- No colors or styling
- Layout is broken
- Console shows CSS errors

**Solution:**
1. Check that Tailwind CSS is properly configured
2. Verify `app/globals.css` has the correct imports
3. Restart the development server:
   ```bash
   # Kill the server (Ctrl+C)
   npm run dev
   ```

---

### Server-Sent Events (SSE) Issues

#### Issue: Real-time updates not working
**Symptoms:**
- Processing page shows no progress
- Items don't update status
- EventSource errors in console

**Solutions:**

1. **Browser compatibility**
   - SSE is supported in all modern browsers
   - Check browser version is up to date

2. **Network issues**
   - Check browser Network tab (F12)
   - Look for `/api/process` request
   - Should show "EventStream" type

3. **Server issues**
   - Check server logs for errors
   - Verify API route is accessible
   - Test with curl:
   ```bash
   curl -N http://localhost:3000/api/process?filename=test.pdf&documentPath=/path/to/file
   ```

---

### Export Issues

#### Issue: Export fails or downloads empty file
**Symptoms:**
- Export button doesn't work
- Downloaded file is empty or corrupted
- Console shows export errors

**Solutions:**

1. **Verify report data exists**
   - Check that processing completed successfully
   - Verify report is in Zustand store

2. **Check file format**
   - Try different export format (JSON, Excel, PDF)
   - JSON export is most reliable for debugging

3. **Browser download settings**
   - Check browser's download settings
   - Verify downloads aren't being blocked

---

## Debugging Tips

### Enable Verbose Logging

Add console logs to track issues:

```typescript
// In processing page
console.log('EventSource created:', eventSource);
console.log('Received data:', data);
console.log('Collected results:', collectedResults);
```

### Check Server Logs

Monitor the terminal running `npm run dev` for:
- API route compilation
- Request/response logs
- Error messages
- Processing times

### Browser DevTools

1. **Console Tab**: Check for JavaScript errors
2. **Network Tab**: Monitor API calls and responses
3. **Application Tab**: Check cookies and session storage
4. **Sources Tab**: Set breakpoints for debugging

### Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `Unauthorized` | No valid session | Re-authenticate |
| `File not found` | Upload path incorrect | Check file upload |
| `Processing failed` | Databricks API error | Check token/API |
| `Export failed` | Report generation error | Check report data |

---

## Performance Issues

### Issue: Slow processing
**Solutions:**
1. Reduce simulated delay in `app/api/process/route.ts`
2. Process fewer checklist items
3. Optimize Databricks API calls (when using real API)

### Issue: High memory usage
**Solutions:**
1. Limit file upload size
2. Clear browser cache
3. Restart development server
4. Check for memory leaks in browser DevTools

---

## Getting Help

If you're still experiencing issues:

1. **Check the logs**
   - Browser console (F12)
   - Server terminal output
   - Network tab in DevTools

2. **Verify environment**
   - Node.js version: 18+
   - All dependencies installed: `npm install`
   - `.env.local` configured correctly

3. **Try a clean start**
   ```bash
   # Stop the server
   # Delete node_modules and reinstall
   rm -rf node_modules
   npm install
   
   # Clear Next.js cache
   rm -rf .next
   
   # Restart
   npm run dev
   ```

4. **Test with minimal setup**
   - Use a small test PDF (< 1MB)
   - Use default checklist
   - Test with a fresh browser session

---

## Known Limitations

1. **Simulated API**: Current implementation uses simulated Databricks API
2. **No PDF Viewer**: Report page doesn't show actual PDF (planned feature)
3. **Single User**: No multi-user support or authentication
4. **No Persistence**: Reports are stored in memory only
5. **File Storage**: Uploaded files stored locally (not production-ready)

---

## Quick Fixes

### Reset Everything
```bash
# Stop server (Ctrl+C)
rm -rf .next node_modules uploads/*
npm install
npm run dev
```

### Clear Browser State
1. Open DevTools (F12)
2. Application tab → Clear storage
3. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Verify Installation
```bash
# Check Node version
node --version  # Should be 18+

# Check dependencies
npm list --depth=0

# Run build to check for errors
npm run build
```

