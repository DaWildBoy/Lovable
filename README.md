# MoveMe TT - Trinidad & Tobago Logistics Marketplace

A production-ready MVP for a logistics marketplace connecting customers who need delivery services with couriers in Trinidad & Tobago.

## Features

### For Customers
- Create delivery jobs with smart pricing recommendations
- View booking likelihood based on distance, cargo, urgency, and offer price
- Receive and compare bids from verified couriers
- Track job status from posting to completion
- Real-time price guidance with interactive graphs

### For Couriers
- Browse available delivery jobs
- Submit competitive bids with custom pricing and ETA
- Complete vehicle and document verification
- Manage accepted jobs and earnings

### For Admins
- Review and approve courier applications
- Verify uploaded documents
- Manage platform users and security

### Core Technology
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth, PostgreSQL, Storage, RLS)
- **Maps**: Google Maps API (Places, Distance Matrix)
- **Security**: Row Level Security policies, email verification
- **Payment**: Prepared fields for future escrow integration

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Google Maps API key

### 1. Clone and Install

```bash
git clone <your-repo>
cd moveme-tt
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 3. Supabase Setup

#### Database
The migrations have already been applied to your Supabase project. The schema includes:
- `profiles` - User profiles with role-based access
- `couriers` - Courier-specific data and verification status
- `courier_documents` - Document storage references
- `jobs` - Delivery job listings with pricing and likelihood data
- `bids` - Courier bids on jobs
- `messages` - Job-specific chat
- `ai_support_conversations` - Support chat history
- `delivery_proofs` - Delivery completion evidence

#### Storage Bucket
Create a storage bucket named `courier-documents`:

1. Go to Supabase Dashboard → Storage
2. Create a new bucket: `courier-documents`
3. Set it to **Private** (RLS will control access)
4. No additional policies needed - handled by database RLS

#### Authentication Settings
Configure auth settings in Supabase Dashboard → Authentication → URL Configuration:

**Important for Production Deployment:**

1. **Site URL**: Set to your production domain
   - Example: `https://your-app.vercel.app`

2. **Redirect URLs**: Add these URLs:
   - `https://your-app.vercel.app/**`
   - `http://localhost:5173/**` (for local development)

3. **Email Confirmation**:
   - Already configured (enabled by default)
   - Users must verify email before accessing the app

### 4. Google Maps API Setup

#### Create API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - **Maps JavaScript API**
   - **Places API**
   - **Distance Matrix API**
4. Create credentials → API Key

#### Restrict API Key (Important for Security and Cost)
1. **Application Restrictions**:
   - HTTP referrers (websites)
   - Add your domains:
     - `https://your-app.vercel.app/*`
     - `http://localhost:5173/*` (for development)

2. **API Restrictions**:
   - Restrict key to only these APIs:
     - Maps JavaScript API
     - Places API
     - Distance Matrix API

3. **Geographic Restrictions** (Highly Recommended):
   - Restrict to Trinidad and Tobago to prevent abuse
   - This reduces costs and ensures service is TT-only

#### Cost Optimization
- Places Autocomplete: ~$2.83 per 1000 requests
- Distance Matrix: ~$5 per 1000 requests
- Set up billing alerts in Google Cloud Console
- Consider adding usage quotas

### 5. Run Locally

```bash
npm run dev
```

Visit `http://localhost:5173`

### 6. Build for Production

```bash
npm run build
```

The `dist` folder contains your production build.

## Deployment

### Deploying to Vercel/Netlify

1. Push your code to GitHub
2. Connect your repository to Vercel/Netlify
3. Add environment variables in the deployment dashboard
4. Deploy

**Remember**: Update Supabase Auth URLs with your production domain!

### Post-Deployment Checklist

- [ ] Update Supabase Site URL to production domain
- [ ] Add production domain to Supabase Redirect URLs
- [ ] Update Google Maps API key restrictions with production domain
- [ ] Test signup/login flow with email verification
- [ ] Test courier document upload to storage bucket
- [ ] Verify RLS policies are working (users can only see their data)
- [ ] Create an admin user for courier approval

## User Roles

### Customer
- Select "Customer" role during signup
- Complete profile with phone number
- Create delivery jobs immediately
- View and accept courier bids

### Courier/Driver
- Select "Courier" role during signup
- Complete profile and vehicle information
- Upload required documents:
  - Driver's License
  - Vehicle Registration
  - Insurance
- Wait for admin approval
- Browse and bid on jobs once approved

### Business
- Similar to Customer but for company delivery management
- Centralized job tracking
- Can manage multiple delivery jobs

### Admin
- Manually set role to "admin" in database
- Access admin dashboard at `/admin`
- Review and approve/reject courier applications
- View uploaded documents

## Creating an Admin User

After signup, manually update the database:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

## Database Functions

### Price Recommendation
Calculates recommended pricing based on:
- Base rate: TTD $15 per km
- Cargo size multiplier (small: 1.0x, medium: 1.3x, large: 1.6x)
- Urgency multiplier (2h: 1.5x, 6h: 1.3x, 24h: 1.1x, 48h+: 1.0x)
- Minimum fee: TTD $50

### Booking Likelihood
Scores job from 0-100 based on:
- Distance (25 points): Shorter = better
- Cargo size (20 points): Smaller = better
- Urgency (20 points): Flexible = better
- Price vs. recommended (35 points): Higher offer = better

Labels:
- 70+ points: "High chance of pickup"
- 50-69 points: "Good chance of pickup"
- <50 points: "Low chance of quick pickup"

## Security

### Row Level Security (RLS)
All tables have RLS enabled with policies:

- **Profiles**: Users can only view/edit their own
- **Jobs**: Customers see their jobs, approved couriers see open jobs
- **Bids**: Couriers can bid, customers see bids on their jobs
- **Documents**: Couriers own their documents, admins can view
- **Messages**: Only job participants can access

### Authentication
- Email verification required
- Password minimum: 6 characters
- Session management via Supabase Auth
- Secure token handling

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── GooglePlacesAutocomplete.tsx
│   ├── LikelihoodGraph.tsx
│   └── RoleSelection.tsx
├── contexts/           # React contexts
│   └── AuthContext.tsx
├── hooks/              # Custom hooks
│   └── useGoogleMaps.ts
├── lib/                # Core utilities
│   ├── supabase.ts
│   ├── database.types.ts
│   └── pricing.ts
├── pages/              # Page components
│   ├── SignupPage.tsx
│   ├── LoginPage.tsx
│   ├── EmailVerificationPage.tsx
│   ├── CompleteProfilePage.tsx
│   ├── CourierOnboardingPage.tsx
│   ├── CustomerDashboard.tsx
│   ├── CourierDashboard.tsx
│   ├── AdminPage.tsx
│   ├── CreateJobPage.tsx
│   └── JobDetailsPage.tsx
├── types/              # TypeScript types
│   └── google-maps.d.ts
├── App.tsx             # Main app component
└── main.tsx            # Entry point
```

## Future Enhancements

- [ ] Real-time chat between customer and courier
- [ ] Push notifications for bid updates
- [ ] Escrow payment integration with Stripe
- [ ] Courier ratings and reviews
- [ ] Route optimization
- [ ] Multi-stop delivery support
- [ ] Mobile app (React Native)
- [ ] SMS notifications
- [ ] In-app messaging
- [ ] Delivery tracking with live location

## Support

For issues or questions:
1. Check Supabase logs for backend errors
2. Check browser console for frontend errors
3. Verify environment variables are set correctly
4. Ensure database migrations ran successfully
5. Check RLS policies if data isn't visible

## License

Private - All rights reserved

---

Built with ❤️ for Trinidad & Tobago
