# Quick Setup Guide - MoveMe TT

## Step-by-Step Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 3. Supabase Configuration

#### A. Database (Already Done)
✅ Migrations have been applied automatically

#### B. Storage Bucket Setup
1. Go to Supabase Dashboard → Storage
2. Click "Create bucket"
3. Name: `courier-documents`
4. Make it **Private**
5. Click "Create"

#### C. Authentication URLs
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Update these settings:

**For Development:**
- Site URL: `http://localhost:5173`
- Redirect URLs: `http://localhost:5173/**`

**For Production (after deployment):**
- Site URL: `https://your-app-domain.com`
- Redirect URLs: `https://your-app-domain.com/**`

### 4. Google Maps API Setup

#### Get API Key
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Go to "APIs & Services" → "Enable APIs & Services"
4. Enable these 3 APIs:
   - Maps JavaScript API
   - Places API
   - Distance Matrix API
5. Go to "Credentials" → "Create Credentials" → "API Key"
6. Copy the API key

#### Restrict API Key (Important!)
1. Click on your API key to edit it
2. Under "Application restrictions":
   - Select "HTTP referrers (web sites)"
   - Add: `http://localhost:5173/*`
   - Add: `https://your-production-domain.com/*` (when deploying)

3. Under "API restrictions":
   - Select "Restrict key"
   - Check only:
     - Maps JavaScript API
     - Places API
     - Distance Matrix API

4. **Optional but Recommended**: Under "Geographic restrictions":
   - Add Trinidad and Tobago (TT) to limit usage to TT only

5. Save

### 5. Run the Application

```bash
npm run dev
```

Visit: `http://localhost:5173`

### 6. Test the Application

#### Test Customer Flow:
1. Click "Sign up"
2. Select "Customer" role
3. Enter email and password
4. Check email for verification link
5. Click verification link
6. Complete profile (name, phone)
7. Create a delivery job
8. View booking likelihood

#### Test Courier Flow:
1. Sign up with a different email
2. Select "Courier" role
3. Complete profile
4. Enter vehicle information
5. Upload documents (driver's license, registration, insurance)
6. Wait for admin approval

#### Test Admin:
1. Manually set your role to admin in database:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
   ```
2. Refresh the page
3. You'll see the admin dashboard
4. Approve courier applications

### 7. Build for Production

```bash
npm run build
```

Check for errors. If successful, you'll see a `dist` folder.

## Troubleshooting

### Issue: "Missing Supabase environment variables"
- Make sure `.env` file exists in root directory
- Check that variable names start with `VITE_`
- Restart dev server after creating `.env`

### Issue: Email verification not working
- Check Supabase Dashboard → Authentication → Email Templates
- Verify "Site URL" is set correctly
- Check spam folder for verification email

### Issue: Google Maps not loading
- Verify API key is correct
- Check that all 3 APIs are enabled
- Check browser console for specific error messages
- Ensure API key restrictions allow your domain

### Issue: Document upload fails
- Verify storage bucket `courier-documents` exists
- Check that bucket is set to Private
- Verify RLS policies exist (they should be automatic)

### Issue: Can't see jobs as courier
- Ensure your courier account is approved by admin
- Check verification_status in couriers table
- Only approved couriers can see and bid on jobs

### Issue: Database connection errors
- Verify Supabase URL and anon key are correct
- Check Supabase project is not paused
- Verify you have internet connection

## Production Deployment Checklist

Before deploying to production:

- [ ] Update `.env` with production Supabase credentials
- [ ] Add Google Maps API key with production domain restrictions
- [ ] Update Supabase Auth URLs with production domain
- [ ] Run `npm run build` to verify no errors
- [ ] Test on production: signup, login, email verification
- [ ] Create at least one admin user
- [ ] Test courier onboarding and approval flow
- [ ] Test job creation and bidding
- [ ] Monitor Supabase and Google Maps usage/costs

## Next Steps After Setup

1. **Create Admin Account**
   - Sign up normally
   - Manually set role to 'admin' in database
   - Use this to approve courier applications

2. **Test All Flows**
   - Customer job creation
   - Courier bidding
   - Admin approval
   - Email verification

3. **Customize Pricing**
   - Adjust rates in `calculate_price_recommendation` function
   - Update base_rate_per_km (currently TTD $15)
   - Modify cargo and urgency multipliers

4. **Monitor Costs**
   - Set up billing alerts in Google Cloud Console
   - Monitor Supabase usage in dashboard
   - Consider implementing rate limiting

## Support Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Google Maps API Documentation](https://developers.google.com/maps/documentation)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

Need help? Check the main README.md for detailed documentation.
