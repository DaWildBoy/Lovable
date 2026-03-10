import { useState, useEffect } from 'react';
import { X, MapPin, Package, Navigation2, Trash2, ShoppingCart, Zap, AlertTriangle, Users, Dumbbell } from 'lucide-react';
import { buildRouteFromJob } from '../lib/jobRoute';
import { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';
import { AssignDriverVehicleModal } from './haulage/AssignDriverVehicleModal';
import { supabase } from '../lib/supabase';
import { calculateDriverFees, formatCurrency, fetchPlatformFeePercentage, DEFAULT_PLATFORM_FEE } from '../lib/pricing';

type JobRow = Database['public']['Tables']['jobs']['Row'];

interface CargoItem {
  id: string;
  dropoff_location_text?: string | null;
  dropoff_contact_name?: string | null;
  dropoff_contact_phone?: string | null;
  cargo_size_category?: string;
  cargo_category?: string;
  cargo_weight_kg?: number | null;
  cargo_notes?: string | null;
  dimensions_length?: number | null;
  dimensions_width?: number | null;
  dimensions_height?: number | null;
  dimensions_unit?: string | null;
  dimensions_length_unit?: string | null;
  dimensions_width_unit?: string | null;
  dimensions_height_unit?: string | null;
}

interface Job extends JobRow {
  cargo_items?: CargoItem[];
}

interface AcceptJobModalProps {
  isOpen: boolean;
  job: Job | null;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function AcceptJobModal({ isOpen, job, onClose, onConfirm, loading }: AcceptJobModalProps) {
  const { profile } = useAuth();
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [platformFeePercent, setPlatformFeePercent] = useState(DEFAULT_PLATFORM_FEE);

  useEffect(() => {
    fetchPlatformFeePercentage().then(fee => setPlatformFeePercent(fee));
  }, []);

  if (!isOpen || !job) return null;

  const route = buildRouteFromJob(job);
  const isHaulageCompany = profile?.business_type === 'haulage';

  const handleAcceptClick = () => {
    if (isHaulageCompany) {
      setShowAssignmentModal(true);
    } else {
      onConfirm();
    }
  };

  const handleAssignment = async (driverId: string, vehicleId: string) => {
    if (!profile || !job) return;

    setAssigning(true);
    try {
      console.log('🔵 Assigning driver and vehicle via RPC...');
      console.log('   Job ID:', job.id);
      console.log('   Driver ID:', driverId);
      console.log('   Vehicle ID:', vehicleId);

      // Call RPC function to assign driver and vehicle (idempotent and atomic)
      // The RPC handles all state checking internally with proper locking and permissions
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('assign_driver_vehicle_to_job', {
          p_job_id: job.id,
          p_driver_id: driverId,
          p_vehicle_id: vehicleId
        });

      if (rpcError) {
        console.error('❌ RPC assignment error:', rpcError);

        // Handle specific error cases with user-friendly messages
        if (rpcError.message.includes('already assigned to another company')) {
          throw new Error('This job has been assigned to another company');
        } else if (rpcError.message.includes('not available for assignment')) {
          throw new Error('This job is no longer available');
        } else if (rpcError.message.includes('not an approved haulage company')) {
          throw new Error('Your company is not approved for job assignments');
        } else {
          throw new Error(rpcError.message);
        }
      }

      if (!rpcResult || !rpcResult.success) {
        console.error('❌ RPC returned unsuccessful result:', rpcResult);
        throw new Error('Assignment failed - please try again');
      }

      if (rpcResult.already_assigned) {
        console.log('✅ Job was already assigned correctly (idempotent success)');
      } else {
        console.log('✅ Job assigned successfully');
      }

      console.log('   Assignment details:', {
        company: rpcResult.company_name,
        driver: rpcResult.driver_name,
        vehicle: rpcResult.vehicle_label,
      });

      setShowAssignmentModal(false);
      onConfirm();
    } catch (error) {
      console.error('❌ Error creating assignment:', error);
      throw error;
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Review Job Details</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">Earnings Breakdown</p>
              <div className="space-y-1.5 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Gross Job Value</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(job.customer_offer_ttd)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Platform Fee ({parseFloat((platformFeePercent * 100).toFixed(1))}%)</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(calculateDriverFees(job.customer_offer_ttd, platformFeePercent).platformFee)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-green-200">
                  <span className="text-sm font-bold text-gray-900">Your Net Payout</span>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(calculateDriverFees(job.customer_offer_ttd, platformFeePercent).netEarnings)}</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">Distance: {job.distance_km} km</p>
            </div>
          </div>

          {job.job_type === 'junk_removal' && (
            <div className="mb-6 p-4 bg-orange-50 border-2 border-orange-300 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-orange-900 text-base">Junk Removal Job</p>
                  <p className="text-xs text-orange-700">Specialized delivery -- review details carefully</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-800">
                  This job requires you to <span className="font-semibold">collect junk/waste items</span> from the customer and transport them to the designated landfill. Ensure your vehicle has enough space for the load.
                </p>
                {(job as any).junk_waste_categories && (job as any).junk_waste_categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {((job as any).junk_waste_categories as string[]).map((cat: string) => (
                      <span key={cat} className="px-2.5 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">{cat}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 space-y-2">
                  {(job as any).junk_curbside === false && (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-100 border border-amber-300 rounded-lg">
                      <Dumbbell className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      <p className="text-amber-900 font-medium text-xs">Items are NOT on the curb -- indoor retrieval required</p>
                    </div>
                  )}
                  {(job as any).junk_curbside === true && (
                    <div className="flex items-center gap-2 p-2.5 bg-green-100 border border-green-300 rounded-lg">
                      <Package className="w-4 h-4 text-green-700 flex-shrink-0" />
                      <p className="text-green-900 font-medium text-xs">Items are on the curb and ready for pickup</p>
                    </div>
                  )}
                  {(job as any).junk_need_extra_hand && (
                    <div className="flex items-center gap-2 p-2.5 bg-blue-100 border border-blue-300 rounded-lg">
                      <Users className="w-4 h-4 text-blue-700 flex-shrink-0" />
                      <p className="text-blue-900 font-medium text-xs">Extra hand requested -- bring a helper for heavy/bulky items</p>
                    </div>
                  )}
                </div>
                {(job as any).junk_landfill_name && (
                  <p className="text-gray-600 mt-2 text-xs">
                    <span className="font-semibold">Landfill:</span> {(job as any).junk_landfill_name}
                  </p>
                )}
              </div>
            </div>
          )}

          {job.job_type === 'marketplace_safebuy' && (
            <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-emerald-900 text-base">Safe-Buy Marketplace Job</p>
                  <p className="text-xs text-emerald-700">Specialized delivery -- review details carefully</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-800">
                  This is a <span className="font-semibold">Safe-Buy inspection and delivery</span>. You will pick up an item from a marketplace seller, inspect it on the buyer's behalf, and deliver it only if the buyer approves. If the buyer rejects, you must return the item to the seller.
                </p>
                {(job as any).marketplace_seller_contact && (
                  <p className="text-gray-600 text-xs mt-1">
                    <span className="font-semibold">Seller Contact:</span> {(job as any).marketplace_seller_contact}
                  </p>
                )}
                {(job as any).marketplace_max_budget && (
                  <p className="text-gray-600 text-xs">
                    <span className="font-semibold">Item Budget:</span> ${(job as any).marketplace_max_budget} TTD
                  </p>
                )}
              </div>
            </div>
          )}

          {job.job_type === 'courier' && (
            <div className="mb-6 p-4 bg-teal-50 border-2 border-teal-300 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-teal-900 text-base">Courier & Errands Job</p>
                  <p className="text-xs text-teal-700">Quick pickup and drop-off for small items</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-800">
                  This is a <span className="font-semibold">courier delivery</span> for small items. Pick up the package and deliver directly to the recipient. Handle with care.
                </p>
                <div className="mt-3 space-y-2">
                  {(job as any).courier_cargo_size && (
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-teal-600" />
                      <span className="text-gray-700 text-xs font-medium">
                        Package: {(job as any).courier_cargo_size === 'envelope' ? 'Envelope / Documents' : (job as any).courier_cargo_size === 'small_parcel' ? 'Small Parcel' : 'Medium Box'}
                      </span>
                    </div>
                  )}
                  {(job as any).courier_recipient_name && (
                    <p className="text-gray-600 text-xs">
                      <span className="font-semibold">Deliver to:</span> {(job as any).courier_recipient_name}
                      {(job as any).courier_recipient_phone && ` (${(job as any).courier_recipient_phone})`}
                    </p>
                  )}
                  {(job as any).courier_require_signature && (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-100 border border-amber-300 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      <p className="text-amber-900 font-medium text-xs">Signature required upon delivery</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Navigation2 className="w-5 h-5 text-blue-600" />
              <p className="text-base font-bold text-gray-900">Complete Route</p>
            </div>

            <div className="space-y-4">
              {route.pickupGroups.map((group, groupIdx) => (
                <div key={group.pickup.id} className="space-y-2 pb-4 border-b border-gray-300 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border-2 border-green-600">
                    <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      P{groupIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-green-900 mb-0.5 uppercase tracking-wide">
                        {group.pickup.label || `Pickup ${groupIdx + 1}`}
                      </p>
                      <p className="text-sm text-gray-900 font-medium">{group.pickup.address}</p>
                    </div>
                  </div>

                  {group.dropoffs.length > 0 && (
                    <div className="ml-5 pl-3 border-l-2 border-gray-300 space-y-2">
                      <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-red-600" />
                        Drop-off Stops for P{groupIdx + 1}
                      </div>
                      {group.dropoffs.map((dropoff, dropoffIdx) => (
                        <div key={dropoff.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border-2 border-red-400">
                          <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {dropoffIdx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-red-900 mb-0.5 uppercase tracking-wide">
                              {dropoff.label || `Stop ${dropoffIdx + 1}`}
                            </p>
                            <p className="text-sm text-gray-900">{dropoff.address}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-900 font-medium">
              ⚠️ Please review the complete route above before accepting. Once you accept, this job will be assigned to you and removed from other couriers' listings.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading || assigning}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAcceptClick}
              disabled={loading || assigning}
              className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading || assigning ? 'Accepting...' : isHaulageCompany ? 'Assign & Accept' : 'Accept Job'}
            </button>
          </div>
        </div>
      </div>

      {showAssignmentModal && job && (
        <AssignDriverVehicleModal
          jobId={job.id}
          onAssign={handleAssignment}
          onCancel={() => setShowAssignmentModal(false)}
        />
      )}
    </div>
  );
}
