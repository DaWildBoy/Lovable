interface Location {
  lat: number;
  lng: number;
  text: string;
}

interface Job {
  id: string;
  pickup_location_text: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_location_text: string;
  dropoff_lat: number;
  dropoff_lng: number;
  price_ttd?: number;
  total_price?: number;
  customer_offer_ttd?: number;
  status: string;
  cargo_size_category?: string;
}

interface BackhaulMatch {
  job: Job;
  distanceToPickup: number;
  distanceFromDropoff: number;
  estimatedFuelCost: number;
  netProfit: number;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Estimate fuel cost based on distance
 * Assumes ~$8 TTD per liter and ~10km per liter fuel efficiency
 */
function estimateFuelCost(pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number): number {
  const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const fuelEfficiency = 10; // km per liter
  const fuelPricePerLiter = 8; // TTD

  const litersNeeded = distance / fuelEfficiency;
  const cost = litersNeeded * fuelPricePerLiter;

  return Math.round(cost);
}

/**
 * Find jobs that match a driver's backhaul opportunity
 *
 * @param currentDropoffLocation - The driver's current active job dropoff location
 * @param driverHomeBase - The driver's home base location
 * @param availableJobs - List of available jobs to search through
 * @param maxPickupDistanceKm - Maximum distance from current dropoff to job pickup (default 10km)
 * @param maxDropoffDistanceKm - Maximum distance from job dropoff to home base (default 10km)
 * @returns Array of matching jobs with calculated profit metrics
 */
export function findBackhaulMatches(
  currentDropoffLocation: Location | null,
  driverHomeBase: Location | null,
  availableJobs: Job[],
  maxPickupDistanceKm: number = 10,
  maxDropoffDistanceKm: number = 10
): BackhaulMatch[] {
  // If driver doesn't have an active dropoff or home base, no matches
  if (!currentDropoffLocation || !driverHomeBase) {
    return [];
  }

  const matches: BackhaulMatch[] = [];

  for (const job of availableJobs) {
    if (job.status !== 'open' && job.status !== 'bidding') continue;

    const pickupLat = Number(job.pickup_lat);
    const pickupLng = Number(job.pickup_lng);
    const dropoffLat = Number(job.dropoff_lat);
    const dropoffLng = Number(job.dropoff_lng);

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) continue;

    const distanceToPickup = calculateDistance(
      currentDropoffLocation.lat,
      currentDropoffLocation.lng,
      pickupLat,
      pickupLng
    );

    const distanceFromDropoff = calculateDistance(
      dropoffLat,
      dropoffLng,
      driverHomeBase.lat,
      driverHomeBase.lng
    );

    if (distanceToPickup <= maxPickupDistanceKm && distanceFromDropoff <= maxDropoffDistanceKm) {
      const estimatedFuelCost = estimateFuelCost(
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng
      );

      const jobPrice = Number(job.customer_offer_ttd || job.total_price || job.price_ttd || 0);
      const netProfit = jobPrice - estimatedFuelCost;

      matches.push({
        job,
        distanceToPickup,
        distanceFromDropoff,
        estimatedFuelCost,
        netProfit,
      });
    }
  }

  // Sort by net profit (highest first)
  matches.sort((a, b) => b.netProfit - a.netProfit);

  return matches;
}

/**
 * Check if a specific job could be a backhaul opportunity for any driver
 * Used to apply "Smart Deal" discount on customer side
 */
export function isBackhaulOpportunity(job: Job): boolean {
  // This is a simplified check - in production, you'd check against
  // actual driver routes and home bases from the database
  // For now, we'll mark jobs in certain routes as potential backhaul opportunities

  // Common return routes (these could be fetched from driver data)
  const commonReturnRoutes = [
    { from: 'San Fernando', to: 'Port of Spain' },
    { from: 'Chaguanas', to: 'Port of Spain' },
    { from: 'Arima', to: 'Port of Spain' },
  ];

  for (const route of commonReturnRoutes) {
    if (
      job.pickup_location_text.toLowerCase().includes(route.from.toLowerCase()) &&
      job.dropoff_location_text.toLowerCase().includes(route.to.toLowerCase())
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate backhaul discount (10% off)
 */
export function calculateBackhaulDiscount(originalPrice: number): number {
  return Math.round(originalPrice * 0.1);
}
