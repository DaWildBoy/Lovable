# Deployment Guide - MoveMe TT

## Pre-Deployment Checklist

Before deploying to production, ensure:

- [x] Application builds successfully (`npm run build`)
- [ ] All environment variables are documented
- [ ] Supabase project is in production mode
- [ ] Google Maps API key has proper restrictions
- [ ] Storage bucket is created
- [ ] Database migrations are applied

## Deployment Platforms

### Option 1: Vercel (Recommended)

#### Steps:
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your repository
5. Configure:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`
7. Deploy

#### Post-Deployment:
1. Note your deployment URL (e.g., `https://moveme-tt.vercel.app`)
2. Update Supabase Auth URLs (see below)
3. Update Google Maps API restrictions (see below)

### Option 2: Netlify

#### Steps:
1. Push your code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect to GitHub and select your repository
5. Configure:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`
7. Deploy

#### Post-Deployment:
Same as Vercel (update Auth URLs and API restrictions)

## Post-Deployment Configuration

### 1. Update Supabase Authentication URLs

Go to Supabase Dashboard → Authentication → URL Configuration:

**Site URL:**
```
https://your-actual-domain.vercel.app
```

**Redirect URLs (add all of these):**
```
https://your-actual-domain.vercel.app/**
http://localhost:5173/**
```

**Important:** Replace `your-actual-domain.vercel.app` with your real deployment URL!

### 2. Update Google Maps API Restrictions

Go to Google Cloud Console → Credentials → Your API Key:

**HTTP Referrers:**
```
https://your-actual-domain.vercel.app/*
http://localhost:5173/*
```

### 3. Create Storage Bucket (if not done)

In Supabase Dashboard → Storage:
1. Create bucket: `courier-documents`
2. Set to Private
3. RLS policies are already configured

### 4. Verify Database Migrations

Check Supabase Dashboard → Database → Migrations to ensure all migrations ran successfully.

### 5. Create Admin User

After deployment:
1. Sign up through the UI with your admin email
2. Run this SQL in Supabase SQL Editor:
```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

## Testing Production Deployment

### Test Checklist:

1. **Authentication Flow**
   - [ ] Sign up with new email
   - [ ] Receive verification email
   - [ ] Click verification link (should redirect to your app)
   - [ ] Complete profile
   - [ ] Login/Logout works

2. **Customer Flow**
   - [ ] Create a job
   - [ ] See price recommendations
   - [ ] View booking likelihood
   - [ ] View job in dashboard

3. **Courier Flow**
   - [ ] Sign up as courier
   - [ ] Complete vehicle info
   - [ ] Upload documents to storage
   - [ ] Documents appear in admin panel

4. **Admin Flow**
   - [ ] Access admin dashboard
   - [ ] View pending couriers
   - [ ] Download/view uploaded documents
   - [ ] Approve courier
   - [ ] Courier can now see jobs

5. **Maps Integration**
   - [ ] Location autocomplete works (TT locations only)
   - [ ] Distance calculation works
   - [ ] Price updates based on distance

## Monitoring

### Supabase Monitoring
- Dashboard → Settings → Usage
- Monitor:
  - Database size
  - Auth users
  - Storage usage
  - API requests

### Google Maps Monitoring
- Cloud Console → APIs & Services → Dashboard
- Monitor:
  - API requests per day
  - Costs
  - Errors

### Set Up Alerts

**Google Cloud:**
1. Billing → Budgets & alerts
2. Create budget alerts at:
   - $10 (warning)
   - $50 (warning)
   - $100 (critical)

**Supabase:**
- Monitor database size
- Check for unusual API activity
- Review auth logs for suspicious signups

## Security Checklist

Production security verification:

- [ ] All Supabase RLS policies are enabled
- [ ] Storage bucket is private (not public)
- [ ] API keys are restricted to production domains only
- [ ] Google Maps API restricted to Trinidad & Tobago
- [ ] No sensitive data in client-side code
- [ ] Email verification is required
- [ ] Password minimum length enforced (6 chars)
- [ ] Admin role can only be set via database (not through UI)

## Rollback Plan

If something goes wrong:

1. **Vercel/Netlify:**
   - Go to Deployments
   - Find previous working deployment
   - Click "Promote to Production"

2. **Database Issues:**
   - Supabase has automatic backups
   - Go to Database → Backups
   - Restore if needed

3. **Config Issues:**
   - Check environment variables in deployment platform
   - Verify Supabase Auth URLs
   - Verify Google Maps restrictions

## Performance Optimization

After deployment, consider:

1. **Enable Caching:**
   - Configure in Vercel/Netlify settings
   - Cache static assets

2. **Database Indexes:**
   - Monitor slow queries in Supabase
   - Add indexes as needed

3. **Image Optimization:**
   - Compress uploaded documents
   - Set file size limits (currently none)

4. **API Rate Limiting:**
   - Consider implementing rate limits
   - Prevent abuse of expensive Google Maps calls

## Cost Management

### Expected Monthly Costs:

**Supabase (Free Tier):**
- Up to 50,000 monthly active users
- 500MB database
- 1GB storage
- After limits: Starts at $25/month

**Google Maps:**
- Depends on usage
- Autocomplete: ~$2.83 per 1,000 requests
- Distance Matrix: ~$5 per 1,000 requests
- First $200/month free credit
- Recommend: Set quotas to control costs

**Hosting (Vercel/Netlify):**
- Free tier sufficient for MVP
- Unlimited bandwidth on free tier

## Maintenance

### Weekly:
- [ ] Check error logs in Vercel/Netlify
- [ ] Review Supabase dashboard for issues
- [ ] Check Google Maps usage/costs

### Monthly:
- [ ] Review and approve pending couriers
- [ ] Check database size growth
- [ ] Review API costs
- [ ] Update dependencies: `npm update`

### As Needed:
- [ ] Respond to user support requests
- [ ] Fix bugs reported by users
- [ ] Add new features based on feedback

## Support & Troubleshooting

### Common Production Issues:

**Issue: Users not receiving verification emails**
- Check Supabase → Authentication → Email Templates
- Verify SMTP settings (Supabase handles this)
- Check spam folders
- Verify "Site URL" matches deployment URL

**Issue: Document upload fails in production**
- Verify storage bucket exists
- Check RLS policies on storage
- Verify CORS settings allow your domain

**Issue: Google Maps not loading**
- Check API key restrictions
- Verify billing is enabled in Google Cloud
- Check browser console for specific errors

**Issue: "Invalid login credentials" despite correct password**
- User may not have verified email
- Check Supabase Auth logs
- Verify user exists in database

**Issue: Courier can't see jobs despite approval**
- Check `verification_status` = 'approved' in database
- Verify `verified` = true
- Check RLS policies allow approved couriers to see jobs

## Scaling Considerations

When you need to scale:

1. **Database:**
   - Upgrade Supabase plan
   - Add database indexes for performance
   - Consider read replicas

2. **Storage:**
   - Implement CDN for document delivery
   - Add image compression
   - Set retention policies

3. **API:**
   - Implement caching layer
   - Add rate limiting
   - Use connection pooling

4. **Features:**
   - Add background job processing
   - Implement websockets for real-time updates
   - Add push notifications

---

## Quick Deploy Commands

```bash
# Build locally to test
npm run build

# Deploy to Vercel CLI (if installed)
vercel --prod

# Deploy to Netlify CLI (if installed)
netlify deploy --prod
```

---

**Remember:** Always test in a staging environment before pushing to production!

For detailed setup instructions, see SETUP_GUIDE.md
For general documentation, see README.md
