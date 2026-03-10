# Backhaul Matching Feature

## Overview

The Backhaul Matching system is an intelligent feature that helps drivers earn money on their return trips instead of driving home empty. It matches available delivery jobs with a driver's route home, creating win-win opportunities for both drivers and customers.

## How It Works

### For Drivers (Couriers)

1. **Set Home Base**: Drivers set their home base location in their profile settings
2. **Active Job Detection**: When a driver has an active delivery job, the system identifies their current dropoff location
3. **Smart Matching**: The system automatically searches for available jobs where:
   - Pickup location is within 10km of the current dropoff
   - Dropoff location is within 10km of the driver's home base
4. **Return Trip Alert**: If a match is found, a special "Return Trip Detected" alert appears at the top of the available jobs list
5. **Profit Calculation**: The alert shows:
   - Route details (pickup → dropoff)
   - Job payment amount
   - Estimated fuel cost
   - Net profit (payment - fuel cost)
6. **Quick Acceptance**: Driver can accept the job directly from the alert

### For Customers

1. **Smart Deal Badge**: Jobs that match common return routes receive a "Smart Deal" discount badge
2. **Automatic Discount**: These jobs show a 10% discount indicator
3. **Faster Service**: Return trip jobs are more likely to be accepted quickly since they're convenient for drivers

## Key Features

### Driver Benefits
- **Maximize Earnings**: Earn money instead of driving home empty
- **Route Efficiency**: Jobs align with their existing route home
- **Clear Profit Info**: See exact net profit after fuel costs
- **Priority Alert**: Special visual alert makes opportunities impossible to miss

### Customer Benefits
- **Lower Prices**: 10% discount on backhaul opportunity jobs
- **Faster Acceptance**: Jobs are more attractive to drivers
- **Win-Win**: Helps drivers while saving money

### Smart Algorithm
- **10km Radius**: Matches jobs within reasonable distance
- **Real-time Detection**: Works with both single and multi-stop deliveries
- **Profit Optimization**: Sorts matches by net profit
- **Non-Intrusive**: Only shows when relevant; doesn't interfere with existing job flow

## Setup Instructions

### 1. Database Migration

The home base location fields have been added to the profiles table:
- `home_base_location_text` (text)
- `home_base_lat` (double precision)
- `home_base_lng` (double precision)

Migration has already been applied via `add_courier_home_base_location.sql`

### 2. Setting Home Base (Drivers)

**Via UI:**
1. Go to Profile page
2. Look for the "Backhaul Matching" section
3. Click "Set Home Base"
4. Enter your home address or usual end location
5. Click "Save Home Base"

**Via SQL (for testing):**
```sql
UPDATE profiles
SET
  home_base_location_text = 'Port of Spain, Trinidad and Tobago',
  home_base_lat = 10.6596,
  home_base_lng = -61.5189
WHERE role = 'courier'
  AND id = 'your-courier-user-id';
```

### 3. Testing the Feature

A comprehensive test data script is available in `BACKHAUL_TEST_DATA.sql`. It includes:

1. Setting a courier's home base to Port of Spain
2. Creating an active job with dropoff in San Fernando
3. Creating a backhaul opportunity job from San Fernando to Port of Spain
4. Additional test scenarios for common routes
5. Verification queries
6. Cleanup scripts

**To test:**
1. Open the SQL file
2. Replace placeholder user IDs with actual IDs from your database
3. Run the queries in your Supabase SQL editor
4. Log in as the courier and navigate to the Jobs page
5. You should see the "Return Trip Detected" alert

## Technical Implementation

### New Files Created

1. **`src/lib/backhaulMatching.ts`**
   - Core matching algorithm
   - Distance calculation (Haversine formula)
   - Fuel cost estimation
   - Profit calculation

2. **`src/components/BackhaulOpportunityAlert.tsx`**
   - Gradient card component for drivers
   - Shows route, profit, and accept button
   - Eye-catching design to ensure visibility

3. **`src/components/SetHomeBaseModal.tsx`**
   - Modal for setting/updating home base
   - Google Places integration
   - Educational messaging

4. **Database Migration**
   - Added home base location fields to profiles table

### Modified Files

1. **`src/pages/courier/CourierJobs.tsx`**
   - Imported backhaul functions
   - Added matching logic (additive, doesn't modify existing code)
   - Renders alert component above job list
   - Added handleAcceptBackhaulJob function

2. **`src/pages/customer/CustomerJobs.tsx`**
   - Imported backhaul functions
   - Added Smart Deal badge detection
   - Shows discount indicator on eligible jobs

3. **`src/pages/courier/CourierProfile.tsx`**
   - Added home base section
   - Integrated SetHomeBaseModal
   - Shows current home base status

## Algorithm Details

### Distance Calculation
Uses the Haversine formula to calculate great-circle distance between two GPS coordinates:
```
Distance = 2 × R × arcsin(√(sin²(Δlat/2) + cos(lat₁) × cos(lat₂) × sin²(Δlng/2)))
```
Where R = Earth's radius (6371 km)

### Fuel Cost Estimation
- Assumes 10 km per liter fuel efficiency
- Assumes $8 TTD per liter of fuel
- Calculates: `cost = (distance / 10) × 8`

### Net Profit
- `Net Profit = Job Payment - Estimated Fuel Cost`
- Displayed prominently in the alert

### Matching Criteria
- Pickup within 10km of current dropoff: ✓
- Dropoff within 10km of home base: ✓
- Job status = 'open': ✓
- Sorted by: Highest net profit first

## Configuration

All distance and cost parameters can be adjusted in `src/lib/backhaulMatching.ts`:

```typescript
// Default matching radius
maxPickupDistanceKm: number = 10
maxDropoffDistanceKm: number = 10

// Fuel cost estimation
fuelEfficiency = 10; // km per liter
fuelPricePerLiter = 8; // TTD

// Discount percentage
calculateBackhaulDiscount(price) => price * 0.1 // 10%
```

## Future Enhancements

Potential improvements for future iterations:

1. **Dynamic Driver Routes**: Track multiple driver routes from actual trip data
2. **Machine Learning**: Predict common routes based on historical data
3. **Time Windows**: Consider delivery time preferences
4. **Multiple Matches**: Show top 3 matches instead of just the best one
5. **Push Notifications**: Alert drivers immediately when a match appears
6. **Route Optimization**: Suggest slight detours for higher-paying jobs
7. **Driver Preferences**: Allow drivers to set multiple frequent destinations
8. **Seasonal Patterns**: Learn and adapt to seasonal route changes

## Benefits Summary

### Environmental Impact
- Reduces empty miles driven
- Lower carbon footprint
- More efficient use of vehicles

### Economic Impact
- Drivers earn more per day
- Customers save money
- Platform generates more transactions

### User Experience
- Non-intrusive (only shows when relevant)
- Clear visual hierarchy
- Simple one-click acceptance
- Transparent profit information

## Support

For questions or issues with the backhaul matching feature:
1. Check the test data script for proper setup
2. Verify home base is set correctly in profile
3. Ensure active jobs exist with proper locations
4. Check browser console for any errors

## Compliance

This feature:
- ✅ Does NOT modify existing job creation logic
- ✅ Does NOT modify existing job acceptance logic
- ✅ Does NOT modify existing job list views
- ✅ Runs completely in parallel to existing systems
- ✅ Is purely additive with no breaking changes
- ✅ Can be disabled by simply not setting a home base
