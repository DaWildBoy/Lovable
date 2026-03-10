import { useState, useEffect } from 'react';
import { UserPlus, Check, X, Clock, Loader2, Mail, Phone, AlertCircle, CreditCard, Eye, XCircle, ZoomIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface PendingDriver {
  id: string;
  full_name: string;
  phone: string | null;
  user_id: string | null;
  created_at: string;
  license_front_url: string | null;
  license_back_url: string | null;
  license_upload_status: string | null;
  user_email?: string;
  user_phone?: string;
  license_front_signed?: string;
  license_back_signed?: string;
}

export function PendingDriverApprovals() {
  const { profile } = useAuth();
  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [viewingLicense, setViewingLicense] = useState<{ driverName: string; front: string | null; back: string | null } | null>(null);

  useEffect(() => {
    fetchPendingDrivers();
  }, [profile?.id]);

  const getSignedUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('driver-id-documents')
      .createSignedUrl(path, 3600);
    if (error) {
      console.error('Error generating signed URL:', error.message, 'path:', path);
      return null;
    }
    return data?.signedUrl || null;
  };

  const fetchPendingDrivers = async () => {
    if (!profile?.id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('haulage_drivers')
        .select('id, full_name, phone, user_id, created_at, license_front_url, license_back_url, license_upload_status')
        .eq('company_id', profile.id)
        .eq('company_approved', false)
        .eq('is_active', true)
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const driversWithProfiles: PendingDriver[] = [];

      for (const driver of data || []) {
        let frontSigned: string | undefined;
        let backSigned: string | undefined;

        if (driver.license_front_url) {
          frontSigned = (await getSignedUrl(driver.license_front_url)) || undefined;
        }
        if (driver.license_back_url) {
          backSigned = (await getSignedUrl(driver.license_back_url)) || undefined;
        }

        if (driver.user_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('email, phone')
            .eq('id', driver.user_id)
            .maybeSingle();

          driversWithProfiles.push({
            ...driver,
            user_email: profileData?.email || undefined,
            user_phone: profileData?.phone || undefined,
            license_front_signed: frontSigned,
            license_back_signed: backSigned,
          });
        } else {
          driversWithProfiles.push({
            ...driver,
            license_front_signed: frontSigned,
            license_back_signed: backSigned,
          });
        }
      }

      setPendingDrivers(driversWithProfiles);
    } catch (err) {
      console.error('Error fetching pending drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (driverId: string) => {
    setActionLoading(driverId);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'approve_company_driver' as string & keyof never,
        { p_driver_id: driverId }
      );

      if (rpcError) throw rpcError;

      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) {
        setError(result.error || 'Failed to approve driver');
        return;
      }

      setPendingDrivers(prev => prev.filter(d => d.id !== driverId));
    } catch (err) {
      console.error('Error approving driver:', err);
      setError('Failed to approve driver. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectLicense = async (driverId: string) => {
    const reason = window.prompt('Reason for rejecting the license (e.g., "Photo is blurry", "Name doesn\'t match"):');
    if (!reason) return;

    setActionLoading(`license-${driverId}`);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('haulage_drivers')
        .update({
          license_upload_status: 'rejected',
          license_rejection_reason: reason,
          license_front_url: null,
          license_back_url: null,
        })
        .eq('id', driverId);

      if (updateError) throw updateError;

      const driver = pendingDrivers.find(d => d.id === driverId);
      if (driver?.user_id) {
        await supabase.from('notifications').insert({
          user_id: driver.user_id,
          type: 'license_rejected',
          title: 'Driver\'s License Rejected',
          message: `Your driver's license was rejected: ${reason}. Please re-upload a clear photo.`,
          data: { reason, company_id: profile?.id },
        });
      }

      await fetchPendingDrivers();
    } catch (err) {
      console.error('Error rejecting license:', err);
      setError('Failed to reject license. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (driverId: string) => {
    if (!window.confirm('Are you sure you want to reject this driver? They will be unlinked from your company.')) return;

    setActionLoading(driverId);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'reject_company_driver' as string & keyof never,
        { p_driver_id: driverId }
      );

      if (rpcError) throw rpcError;

      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) {
        setError(result.error || 'Failed to reject driver');
        return;
      }

      setPendingDrivers(prev => prev.filter(d => d.id !== driverId));
    } catch (err) {
      console.error('Error rejecting driver:', err);
      setError('Failed to reject driver. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-center gap-2 text-amber-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading pending requests...</span>
        </div>
      </div>
    );
  }

  if (pendingDrivers.length === 0) return null;

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-amber-100 px-5 py-4 border-b border-amber-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-amber-900">Pending Driver Approvals</h3>
              <p className="text-xs text-amber-700">
                {pendingDrivers.length} driver{pendingDrivers.length !== 1 ? 's' : ''} awaiting your approval
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-sm font-bold rounded-full">
            {pendingDrivers.length}
          </span>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="p-5 space-y-3">
        {pendingDrivers.map((driver) => {
          const isProcessing = actionLoading === driver.id;
          const hasLicense = driver.license_front_signed || driver.license_back_signed;

          return (
            <div
              key={driver.id}
              className="bg-white rounded-lg border border-amber-200 p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-amber-700">
                        {driver.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm truncate">{driver.full_name}</h4>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>Requested {formatDate(driver.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-10 space-y-0.5">
                    {driver.user_email && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Mail className="w-3 h-3 text-gray-400" />
                        <span className="truncate">{driver.user_email}</span>
                      </div>
                    )}
                    {(driver.user_phone || driver.phone) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span>{driver.user_phone || driver.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(driver.id)}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {actionLoading === driver.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(driver.id)}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>

              {hasLicense ? (
                <div className="mt-3 ml-10">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-700">Driver's License</span>
                  </div>
                  <div className="flex gap-2">
                    {driver.license_front_signed && (
                      <div
                        className="relative w-20 h-14 rounded-lg overflow-hidden border border-gray-200 cursor-pointer group"
                        onClick={() => setViewingLicense({
                          driverName: driver.full_name,
                          front: driver.license_front_signed || null,
                          back: driver.license_back_signed || null,
                        })}
                      >
                        <img src={driver.license_front_signed} alt="License front" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5 font-medium">Front</span>
                      </div>
                    )}
                    {driver.license_back_signed && (
                      <div
                        className="relative w-20 h-14 rounded-lg overflow-hidden border border-gray-200 cursor-pointer group"
                        onClick={() => setViewingLicense({
                          driverName: driver.full_name,
                          front: driver.license_front_signed || null,
                          back: driver.license_back_signed || null,
                        })}
                      >
                        <img src={driver.license_back_signed} alt="License back" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5 font-medium">Back</span>
                      </div>
                    )}
                    <button
                      onClick={() => setViewingLicense({
                        driverName: driver.full_name,
                        front: driver.license_front_signed || null,
                        back: driver.license_back_signed || null,
                      })}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Full
                    </button>
                    <button
                      onClick={() => handleRejectLicense(driver.id)}
                      disabled={actionLoading === `license-${driver.id}`}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                    >
                      {actionLoading === `license-${driver.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      Request Re-upload
                    </button>
                  </div>
                  {driver.license_upload_status === 'rejected' && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertCircle className="w-3 h-3" />
                      <span>Re-upload requested - waiting for driver</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 ml-10">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <XCircle className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {driver.license_upload_status === 'rejected'
                        ? 'License rejected - awaiting re-upload from driver'
                        : 'No driver\'s license uploaded'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {viewingLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewingLicense(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold text-gray-900">Driver's License</h3>
                <p className="text-xs text-gray-500">{viewingLicense.driverName}</p>
              </div>
              <button
                onClick={() => setViewingLicense(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {viewingLicense.front && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Front</p>
                  <img
                    src={viewingLicense.front}
                    alt="License front"
                    className="w-full rounded-xl border border-gray-200 shadow-sm"
                  />
                </div>
              )}
              {viewingLicense.back && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Back</p>
                  <img
                    src={viewingLicense.back}
                    alt="License back"
                    className="w-full rounded-xl border border-gray-200 shadow-sm"
                  />
                </div>
              )}
              {!viewingLicense.front && !viewingLicense.back && (
                <div className="text-center py-8">
                  <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No license images available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
