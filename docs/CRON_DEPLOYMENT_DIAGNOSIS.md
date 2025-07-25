# Cron Deployment Diagnosis Guide

## Issue Summary

The Voice Memory project has been experiencing 404 errors with the cron endpoint after recent changes to consolidate the processing pipeline. This guide provides comprehensive diagnostic procedures and troubleshooting steps to identify and resolve cron deployment issues.

### Recent Changes Context

- **Endpoint Consolidation Complete**: Old `/api/cron/process-batch` endpoint completely removed
- **Unified Architecture**: **app/api/process/batch/route.ts** now handles all batch processing with dual authentication
- **Enhanced Production Features**: Timeout protection, concurrency control, circuit breaker integration, and comprehensive health metrics ported from old endpoint
- **Single Source of Truth**: All batch processing flows through one consolidated, production-ready endpoint

## Diagnostic Checklist

Follow this systematic approach to diagnose cron deployment issues:

### 1. File Structure Verification

**Check that all required files exist:**

```bash
# Run the verification script
npx tsx scripts/verify-vercel-deployment.ts --production
```

**Manual verification:**
- [ ] `app/api/process/batch/route.ts` exists and exports POST function with dual authentication
- [ ] Old `app/api/cron/process-batch/route.ts` and `app/api/cron/` directory have been completely removed
- [ ] `lib/cron-auth.ts` contains authentication utilities  
- [ ] `vercel.json` points cron job to `/api/process/batch` and has cleaned function configurations

### 2. Endpoint Accessibility Testing

**Test unified endpoint with dual authentication:**

```bash
# Test unified endpoint with cron and user authentication scenarios
npx tsx scripts/test-cron-endpoint-direct.ts --production

# Comprehensive deployment diagnostics for unified endpoint
npx tsx scripts/diagnose-cron-deployment.ts --production
```

### 3. Vercel Deployment Logs

**Check deployment status in Vercel Dashboard:**
1. Go to [Vercel Dashboard](https://vercel.com) → Your Project → Functions
2. Verify that `/api/process/batch` appears in the functions list
3. Check recent deployment logs for build errors
4. Look for any warnings about missing files or build failures

### 4. Environment Variables Validation

**Required environment variables:**
- [ ] `CRON_SECRET` - Authentication token for cron jobs
- [ ] `OPENAI_API_KEY` - OpenAI API access
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Database connection
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase access

### 5. Authentication Configuration

**Test authentication mechanisms:**
- [ ] Bearer token authentication with `CRON_SECRET`
- [ ] Vercel cron headers (`x-vercel-cron`, `x-vercel-signature`)
- [ ] Proper error responses for invalid authentication

## Common Deployment Issues

### 1. File Structure Mismatches

**Problem:** API routes not following Next.js App Router conventions

**Symptoms:**
- 404 errors on endpoint requests
- Functions not appearing in Vercel dashboard
- Build completing without errors but endpoints missing

**Solution:**
```bash
# Verify correct unified structure
app/
├── api/
│   ├── process/
│   │   ├── batch/
│   │   │   └── route.ts  # Unified endpoint with dual authentication
│   │   └── route.ts      # Individual note processing
│   └── [other endpoints...]
# Note: app/api/cron/ directory should be completely removed
```

### 2. Build Failures

**Problem:** TypeScript errors or missing dependencies preventing deployment

**Symptoms:**
- Build logs show compilation errors
- Functions missing from Vercel dashboard
- Partial deployment with some endpoints working

**Solution:**
```bash
# Test local build
npm run build

# Check for TypeScript errors
npm run type-check

# Resolve dependency issues
npm install
```

### 3. Function Timeout Configurations

**Problem:** Long-running processing functions timing out

**Symptoms:**
- 504 Gateway Timeout errors
- Functions starting but not completing
- Partial processing results

**Solution:**
Check `vercel.json` configuration:
```json
{
  "functions": {
    "app/api/process/**/*.ts": {
      "maxDuration": 600
    }
  }
}
```

### 4. Environment Variable Issues

**Problem:** Missing or incorrect environment variables

**Symptoms:**
- 401 Unauthorized responses
- Authentication failures
- Database connection errors

**Solution:**
1. Verify variables in Vercel Dashboard → Settings → Environment Variables
2. Ensure `CRON_SECRET` matches the value used in authentication
3. Check variable names match exactly (case-sensitive)

### 5. Routing Conflicts

**Problem:** Multiple endpoints competing for the same route

**Symptoms:**
- Inconsistent responses
- Wrong endpoint being called
- Authentication working inconsistently

**Solution:**
- Verify only the unified `/api/process/batch` endpoint exists  
- Ensure old `/api/cron/process-batch` endpoint is completely removed
- Update `vercel.json` to point cron jobs to unified endpoint
- Remove any conflicting route configurations

## Testing Procedures

### Using Diagnostic Scripts

**1. Quick Health Check:**
```bash
npx tsx scripts/verify-vercel-deployment.ts --production
```
- Validates file structure
- Checks Vercel configuration
- Tests environment variables
- Verifies function deployment

**2. Endpoint Testing:**
```bash
npx tsx scripts/test-cron-endpoint-direct.ts --production
```
- Tests authentication scenarios for unified endpoint
- Validates both cron and user authentication flows
- Identifies specific failure points
- Provides detailed error information

**3. Comprehensive Diagnosis:**
```bash
npx tsx scripts/diagnose-cron-deployment.ts --production
```
- Full endpoint accessibility testing
- Authentication validation
- Performance metrics
- Deployment recommendations

### Manual Testing

**Test endpoint accessibility:**
```bash
# Test with curl (replace YOUR_CRON_SECRET)
curl -X POST \
  [YOUR_DEPLOYMENT_URL]/api/process/batch \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Expected responses:**
- **200/201**: Success - endpoint working correctly
- **401**: Unauthorized - check `CRON_SECRET` 
- **404**: Not Found - endpoint not deployed
- **405**: Method Not Allowed - POST method not exported
- **500**: Internal Server Error - check function logs

## Troubleshooting Steps

### For 404 Errors

1. **Verify file exists locally:**
   ```bash
   ls -la app/api/process/batch/route.ts
   ```

2. **Check file exports POST function:**
   ```bash
   grep "export.*POST" app/api/process/batch/route.ts
   ```

3. **Verify build includes the file:**
   ```bash
   npm run build
   # Check .next/server/app/api/process/batch for generated files
   ```

4. **Check Vercel Functions tab:**
   - Go to Vercel Dashboard → Functions
   - Look for `/api/process/batch` in the list
   - If missing, redeploy the application

### For Authentication Errors

1. **Verify CRON_SECRET is set:**
   ```bash
   # Check locally
   echo $CRON_SECRET
   
   # Check in Vercel (via dashboard)
   ```

2. **Test authentication logic:**
   ```bash
   # Use test script with debug output
   DEBUG=1 npx tsx scripts/test-cron-endpoint-direct.ts --production
   ```

3. **Verify authentication implementation:**
   - Check that dual authentication is working in unified endpoint
   - Test both cron and user authentication scenarios
   - Ensure `isAuthorizedCronRequest()` function is working correctly

### For Function Timeout Issues

1. **Check function duration limits:**
   - Verify `vercel.json` sets appropriate `maxDuration`
   - Default timeout is 10 seconds for Hobby plan
   - Processing may need 60-300 seconds

2. **Monitor function execution:**
   - Check Vercel Functions logs for timeout errors
   - Look for partial execution logs
   - Consider breaking large batches into smaller chunks

## Resolution Strategies

### Quick Fixes

1. **Verify unified endpoint configuration:**
   ```json
   // vercel.json
   {
     "crons": [
       {
         "path": "/api/process/batch",
         "schedule": "*/5 * * * *",
         "method": "POST",
         "headers": {
           "Authorization": "Bearer ${CRON_SECRET}"
         }
       }
     ]
   }
   ```

2. **Redeploy application:**
   ```bash
   # Force redeploy
   git commit --allow-empty -m "Force redeploy"
   git push
   ```

### Comprehensive Fixes

1. **File structure correction:**
   - Ensure proper Next.js App Router structure
   - Verify all required files exist
   - Check that exports match expected patterns

2. **Configuration updates:**
   - Update `vercel.json` with correct paths
   - Set appropriate function timeouts
   - Verify environment variable names

3. **Code fixes:**
   - Ensure POST function is properly exported
   - Verify authentication logic matches `lib/cron-auth.ts`
   - Test error handling and response formats

### Environment Variable Updates

1. **In Vercel Dashboard:**
   - Go to Settings → Environment Variables
   - Add/update `CRON_SECRET` with a secure random string
   - Ensure all required variables are set for Production environment

2. **Local testing:**
   ```bash
   # Update .env.local
   CRON_SECRET="your-secure-random-string"
   
   # Test locally
   npm run dev
   npx tsx scripts/test-cron-endpoint-direct.ts
   ```

## Prevention Strategies

### Deployment Best Practices

1. **Always test locally first:**
   ```bash
   npm run build
   npm run start
   # Test endpoints before deploying
   ```

2. **Use staging deployments:**
   - Test changes on preview deployments
   - Verify cron functionality before promoting to production
   - Use feature flags for gradual rollouts

3. **Monitor deployment health:**
   ```bash
   # Regular health checks
   npx tsx scripts/verify-vercel-deployment.ts --production
   ```

### Code Review Checklist

- [ ] All API routes export required HTTP methods
- [ ] Environment variables are properly referenced
- [ ] Authentication logic is consistent across endpoints
- [ ] Function timeouts are appropriate for processing needs
- [ ] Error handling provides useful debugging information

### Monitoring and Alerting

1. **Set up Vercel monitoring:**
   - Enable function logs collection
   - Set up alerts for 404/500 errors
   - Monitor function execution duration

2. **Health check endpoints:**
   - Create `/api/health` endpoint for monitoring
   - Include database connectivity checks
   - Verify all critical services are accessible

## Emergency Procedures

### If Cron Jobs Are Completely Broken

1. **Immediate fallback:**
   ```bash
   # Revert vercel.json to last working state
   git revert <commit-hash>
   git push
   ```

2. **Manual processing trigger:**
   ```bash
   # Use manual processing script
   npx tsx scripts/manual-trigger-processing.ts
   ```

3. **Health monitoring:**
   ```bash
   # Monitor system recovery
   npx tsx scripts/monitor-processing-health.ts
   ```

### Communication Plan

1. **User notification:** If processing is significantly delayed
2. **Status page update:** For extended outages
3. **Post-mortem:** Document root cause and prevention measures

## Reference Links

- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [Next.js App Router API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [Voice Memory Processing Architecture](./VERCEL_DEPLOYMENT.md)

## Contact and Support

For additional support with cron deployment issues:

1. **Check existing issues:** Review recent deployment logs and error patterns
2. **Run diagnostic scripts:** Use provided tools for systematic troubleshooting
3. **Document findings:** Include script outputs when reporting issues
4. **Test fixes locally:** Always verify solutions work before deploying

---

*Last updated: 2025-01-19*  
*Version: 1.0*