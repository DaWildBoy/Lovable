import { useState } from 'react';
import { MapPin, CheckCircle2, Clock, X, Loader2, Package, Phone, User, Navigation, AlertCircle, Image, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DeliveryStop {
  id: string;
  job_id: string;
  stop_index: number;
  stop_type: 'PICKUP' | 'DROPOFF';
  location_text: string;
  location_lat: number | null;
  location_lng: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: 'NOT_STARTED' | 'ENROUTE' | 'ARRIVED' | 'COMPLETED';
  arrived_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PODStop {
  id: string;
  stop_id: string;
  job_id: string;
  required_type: 'NONE' | 'PHOTO' | 'SIGNATURE' | 'PHOTO_AND_SIGNATURE';
  status: 'NOT_REQUIRED' | 'REQUIRED' | 'PENDING' | 'COMPLETED';
  photo_urls: string[];
  signature_image_url: string | null;
  signed_by_name: string | null;
  recipient_name: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
  notes: string | null;
}

interface RetailMultiStopDeliveryProps {
  jobId: string;
  jobStatus: string;
  stops: DeliveryStop[];
  podStops: PODStop[];
  podRequired: string;
  onStopUpdate: () => void | Promise<void>;
  onJobComplete: () => void;
  onNotification: (message: string, type: 'success' | 'info' | 'warning') => void;
}

export function RetailMultiStopDelivery({
  jobId,
  jobStatus,
  stops,
  podStops,
  podRequired,
  onStopUpdate,
  onJobComplete,
  onNotification
}: RetailMultiStopDeliveryProps) {
  const [completionModalStop, setCompletionModalStop] = useState<DeliveryStop | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [completingStop, setCompletingStop] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [completingJob, setCompletingJob] = useState(false);
  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());
  const [reloading, setReloading] = useState(false);

  const sortedStops = [...stops].sort((a, b) => a.stop_index - b.stop_index);
  const pickupStops = sortedStops.filter(s => s.stop_type === 'PICKUP');
  const dropoffStops = sortedStops.filter(s => s.stop_type === 'DROPOFF');

  const completedCount = stops.filter(s => s.status === 'COMPLETED').length;
  const totalCount = stops.length;
  const allStopsCompleted = completedCount === totalCount;
  const allDropoffsDelivered = dropoffStops.every(s => s.status === 'COMPLETED');

  const getStopPOD = (stopId: string) => {
    return podStops.find(pod => pod.stop_id === stopId);
  };

  const toggleStopExpanded = (stopId: string) => {
    setExpandedStops(prev => {
      const next = new Set(prev);
      if (next.has(stopId)) {
        next.delete(stopId);
      } else {
        next.add(stopId);
      }
      return next;
    });
  };

  const canMarkDelivered = (stop: DeliveryStop): { allowed: boolean; reason?: string } => {
    if (stop.stop_type === 'PICKUP') return { allowed: true };
    if (stop.status !== 'ARRIVED') return { allowed: false, reason: 'Must arrive first' };

    const pod = getStopPOD(stop.id);
    if (!pod || pod.required_type === 'NONE') return { allowed: true };

    const needsPhoto = pod.required_type === 'PHOTO' || pod.required_type === 'PHOTO_AND_SIGNATURE';
    const needsSignature = pod.required_type === 'SIGNATURE' || pod.required_type === 'PHOTO_AND_SIGNATURE';

    if (needsPhoto && (!pod.photo_urls || pod.photo_urls.length === 0)) {
      return { allowed: false, reason: 'Photo required' };
    }

    // For web testing: Allow proceeding without signature (will show warning in modal)
    // In production mobile app, signature should be strictly enforced
    if (needsSignature && !pod.signature_image_url) {
      return { allowed: true, reason: 'Signature missing (will proceed anyway for testing)' };
    }

    return { allowed: true };
  };

  const getStatusLabel = (status: string, stopType: 'PICKUP' | 'DROPOFF') => {
    if (status === 'COMPLETED') {
      return stopType === 'PICKUP' ? 'Collected' : 'Delivered';
    }
    return status.replace('_', ' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NOT_STARTED': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'ENROUTE': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'ARRIVED': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'COMPLETED': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const isValidUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const handleStatusChange = async (stopId: string, newStatus: string) => {
    // Check if this is a valid UUID
    if (!isValidUUID(stopId)) {
      console.error('Invalid stop ID detected:', stopId);
      onNotification('Stop data is invalid. Refreshing...', 'warning');

      // Trigger a reload to get fresh data from database
      setTimeout(() => {
        onStopUpdate();
      }, 1000);
      return;
    }

    setUpdatingStatus(stopId);
    try {
      const updates: any = { status: newStatus };

      if (newStatus === 'ARRIVED') {
        updates.arrived_at = new Date().toISOString();
      } else if (newStatus === 'COMPLETED') {
        updates.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('delivery_stops')
        .update(updates)
        .eq('id', stopId)
        .select();

      if (error) {
        console.error('Error updating delivery stop:', error);
        throw new Error(error.message || 'Database error');
      }

      if (!data || data.length === 0) {
        throw new Error('No stop was updated - check permissions');
      }

      const statusLabel = newStatus === 'COMPLETED'
        ? (stops.find(s => s.id === stopId)?.stop_type === 'PICKUP' ? 'Collected' : 'Delivered')
        : newStatus.replace('_', ' ').toLowerCase();

      onNotification(`${statusLabel}`, 'success');
      onStopUpdate();
    } catch (error: any) {
      console.error('Error updating stop status:', error);
      const errorMsg = error.message || 'Failed to update status';
      onNotification(`Error: ${errorMsg}`, 'warning');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleUploadPhotos = async (stopId: string, files: FileList) => {
    setUploadingPhotos(true);
    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${jobId}/${stopId}/${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('pod-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('pod-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      let pod = getStopPOD(stopId);

      // If POD record doesn't exist, create it
      if (!pod) {
        const { data: newPod, error: insertError } = await supabase
          .from('pod_stops')
          .insert({
            stop_id: stopId,
            job_id: jobId,
            required_type: podRequired,
            status: podRequired === 'NONE' ? 'NOT_REQUIRED' : 'REQUIRED'
          })
          .select()
          .single();

        if (insertError) throw insertError;
        pod = newPod;
      }

      const { error: updateError } = await supabase
        .from('pod_stops')
        .update({
          photo_urls: [...(pod.photo_urls || []), ...uploadedUrls],
          status: pod.required_type.includes('SIGNATURE') ? 'PENDING' : 'COMPLETED',
          completed_at: !pod.required_type.includes('SIGNATURE') ? new Date().toISOString() : null
        })
        .eq('id', pod.id);

      if (updateError) throw updateError;

      onNotification(`${uploadedUrls.length} photo(s) uploaded successfully`, 'success');
      await onStopUpdate();

      // After upload, check if we can auto-proceed to completion
      const stop = deliveryStops.find(s => s.id === stopId);
      if (stop && stop.stop_type === 'DROPOFF') {
        const needsSignature = pod.required_type === 'SIGNATURE' || pod.required_type === 'PHOTO_AND_SIGNATURE';

        // If only photo was required (no signature needed), auto-open completion modal
        if (!needsSignature) {
          setTimeout(() => {
            setCompletionModalStop(stop);
            const podData = getStopPOD(stopId);
            setRecipientName(podData?.recipient_name || '');
            setDeliveryNotes(podData?.notes || '');
          }, 300);
        } else {
          // Signature is still required - show helpful message
          onNotification('Photo uploaded! Signature still required (use mobile app to complete)', 'success');
        }
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      onNotification('Failed to upload photos', 'warning');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleCompleteStop = async () => {
    if (!completionModalStop) return;

    setCompletingStop(true);
    try {
      const pod = getStopPOD(completionModalStop.id);

      if (pod && pod.required_type !== 'NONE') {
        if (pod.required_type.includes('PHOTO') && (!pod.photo_urls || pod.photo_urls.length === 0)) {
          onNotification('Please upload at least one photo before completing', 'warning');
          setCompletingStop(false);
          return;
        }

        // For web testing: Allow completing without signature (with warning)
        // In production mobile app, signature should be enforced
        if (pod.required_type.includes('SIGNATURE') && !pod.signature_image_url) {
          console.warn('Completing delivery without signature - testing mode');
          onNotification('Completing without signature (testing mode)', 'success');
        }
      }

      const completionTime = new Date().toISOString();

      // Update the delivery stop
      const { error: stopError } = await supabase
        .from('delivery_stops')
        .update({
          status: 'COMPLETED',
          completed_at: completionTime,
          notes: deliveryNotes || null
        })
        .eq('id', completionModalStop.id);

      if (stopError) throw stopError;

      // Update POD stop
      if (pod) {
        const { error: podError } = await supabase
          .from('pod_stops')
          .update({
            status: 'COMPLETED',
            recipient_name: recipientName || null,
            notes: deliveryNotes || null,
            completed_at: completionTime
          })
          .eq('id', pod.id);

        if (podError) throw podError;
      }

      // Find and update cargo items at this delivery location
      console.log('🔍 Looking for cargo items at stop:', completionModalStop.location_text);

      let { data: cargoItems, error: cargoFetchError } = await supabase
        .from('cargo_items')
        .select('*')
        .eq('job_id', jobId)
        .eq('dropoff_location_text', completionModalStop.location_text)
        .eq('status', 'pending');

      // If no items found by exact match, try to find items for this job without specific dropoff
      if (!cargoFetchError && (!cargoItems || cargoItems.length === 0)) {
        console.log('🔍 No items found with exact location match, checking for items without specific dropoff...');
        const { data: allItems } = await supabase
          .from('cargo_items')
          .select('*')
          .eq('job_id', jobId)
          .eq('status', 'pending');

        if (allItems && allItems.length > 0) {
          console.log(`🔍 Found ${allItems.length} pending items for this job`);
          // For multi-stop retail jobs, items might be linked to stops through assigned_stop_index
          // Filter by items that don't have a dropoff_location_text (they use job-level dropoff)
          cargoItems = allItems.filter(item => !item.dropoff_location_text || item.dropoff_location_text === completionModalStop.location_text);
        }
      }

      console.log(`🔍 Found ${cargoItems?.length || 0} cargo items to update`);

      if (cargoFetchError) {
        console.error('Error fetching cargo items:', cargoFetchError);
      } else if (cargoItems && cargoItems.length > 0) {
        // Get the first photo URL from POD if available
        const photoUrl = pod && pod.photo_urls && pod.photo_urls.length > 0
          ? pod.photo_urls[0]
          : null;

        // Update each cargo item
        for (let i = 0; i < cargoItems.length; i++) {
          const item = cargoItems[i];

          const { error: updateError } = await supabase
            .from('cargo_items')
            .update({
              delivered_at: completionTime,
              delivered_to_name: recipientName || null,
              delivery_proof_photo_url: photoUrl,
              delivery_notes_from_courier: deliveryNotes || null,
              status: 'delivered',
            })
            .eq('id', item.id);

          console.log(`✅ Updated cargo item ${item.id} with delivery info`);
          if (photoUrl) console.log(`📸 Photo URL saved: ${photoUrl}`);

          if (updateError) {
            console.error(`Error updating cargo item ${item.id}:`, updateError);
          } else {
            // Send notification for this cargo delivery
            const cargoNumber = i + 1;
            const cargoName = item.cargo_category === 'other'
              ? item.cargo_category_custom || 'Item'
              : item.cargo_category;
            onNotification(`Cargo ${cargoNumber} (${cargoName}) delivered successfully!`, 'success');
          }
        }
      }

      setCompletionModalStop(null);
      setRecipientName('');
      setDeliveryNotes('');
      onStopUpdate();
    } catch (error) {
      console.error('Error completing stop:', error);
      onNotification('Failed to complete stop', 'warning');
    } finally {
      setCompletingStop(false);
    }
  };

  const handleCompleteEntireJob = async () => {
    setCompletingJob(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;

      onNotification('Job completed successfully!', 'success');
      onJobComplete();
    } catch (error) {
      console.error('Error completing job:', error);
      onNotification('Failed to complete job', 'warning');
    } finally {
      setCompletingJob(false);
    }
  };

  const renderStopRow = (stop: DeliveryStop, displayIndex: number) => {
    const pod = getStopPOD(stop.id);
    const isPickup = stop.stop_type === 'PICKUP';
    const isUpdating = updatingStatus === stop.id;
    const isExpanded = expandedStops.has(stop.id);
    const deliverCheck = canMarkDelivered(stop);

    return (
      <div
        key={stop.id}
        id={`stop-${stop.id}`}
        className={`border-2 rounded-lg transition-all ${
          stop.status === 'COMPLETED'
            ? 'bg-green-50 border-green-300'
            : 'bg-white border-gray-300'
        }`}
      >
        <div className="p-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
              stop.status === 'COMPLETED'
                ? 'bg-green-600 text-white'
                : stop.status === 'ARRIVED'
                ? 'bg-yellow-500 text-white'
                : stop.status === 'ENROUTE'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-300 text-gray-700'
            }`}>
              {stop.status === 'COMPLETED' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <span>{displayIndex}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-500 uppercase">
                    {isPickup ? `Pickup ${displayIndex}` : `Stop ${displayIndex}`}
                  </p>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {stop.location_text}
                  </h3>
                </div>
                {stop.status !== 'COMPLETED' && (
                  <button
                    onClick={() => toggleStopExpanded(stop.id)}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                )}
              </div>

              {stop.status !== 'COMPLETED' ? (
                <>
                  {/* STATUS DISPLAY ONLY (No buttons - controlled via Driver Cockpit) */}
                  <div className="mb-2">
                    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${getStatusColor(stop.status)}`}>
                      {getStatusLabel(stop.status, stop.stop_type)}
                    </span>
                  </div>

                  {!deliverCheck.allowed && !isPickup && (
                    <div
                      onClick={() => toggleStopExpanded(stop.id)}
                      className="mb-2 p-2 bg-amber-50 border border-amber-300 rounded-lg cursor-pointer hover:bg-amber-100"
                    >
                      <p className="text-xs text-amber-800 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {deliverCheck.reason}
                        {!isExpanded && <span className="ml-1 text-amber-600">(Click to upload POD)</span>}
                      </p>
                    </div>
                  )}

                  {(isExpanded || stop.status === 'ARRIVED') && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                      {(stop.contact_name || stop.contact_phone) && (
                        <div className="text-xs text-gray-600 space-y-1">
                          {stop.contact_name && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{stop.contact_name}</span>
                            </div>
                          )}
                          {stop.contact_phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <a href={`tel:${stop.contact_phone}`} className="text-blue-600 hover:underline">
                                {stop.contact_phone}
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {pod && pod.required_type !== 'NONE' && (
                        <div className={`p-3 border-2 rounded-lg text-xs ${
                          stop.status === 'ARRIVED' && (!pod.photo_urls || pod.photo_urls.length === 0)
                            ? 'bg-amber-100 border-amber-400'
                            : 'bg-amber-50 border-amber-200'
                        }`}>
                          <p className="font-semibold text-amber-900 flex items-center gap-1 mb-2">
                            <AlertCircle className="w-4 h-4" />
                            POD Required: {pod.required_type.replace(/_/g, ' ')}
                          </p>
                          {pod.photo_urls && pod.photo_urls.length > 0 && (
                            <p className="text-green-700 font-semibold mb-2 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              {pod.photo_urls.length} photo(s) uploaded
                            </p>
                          )}
                          {!isPickup && (pod.required_type === 'PHOTO' || pod.required_type === 'PHOTO_AND_SIGNATURE') && (
                            <div className="mt-2">
                              <label className="block font-bold text-amber-900 mb-2">
                                {(!pod.photo_urls || pod.photo_urls.length === 0) && stop.status === 'ARRIVED' && (
                                  <span className="flex items-center gap-1">
                                    <Image className="w-4 h-4" />
                                    Upload Photo(s) to Continue:
                                  </span>
                                )}
                                {(pod.photo_urls && pod.photo_urls.length > 0) && 'Add More Photos (Optional):'}
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                capture="environment"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handleUploadPhotos(stop.id, e.target.files);
                                  }
                                }}
                                disabled={uploadingPhotos}
                                className="block w-full text-xs text-gray-900 border-2 border-amber-400 rounded-lg cursor-pointer bg-white focus:outline-none p-2 font-semibold"
                              />
                              {uploadingPhotos && (
                                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1 font-semibold">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Uploading photos...
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(stop.status)}`}>
                    <CheckCircle2 className="w-4 h-4" />
                    {getStatusLabel(stop.status, stop.stop_type)}
                  </span>
                  {stop.completed_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(stop.completed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getNextAction = () => {
    const firstIncompletePickup = pickupStops.find(s => s.status !== 'COMPLETED');
    if (firstIncompletePickup) {
      const pickupIndex = pickupStops.indexOf(firstIncompletePickup) + 1;
      return {
        title: `Go to Pickup P${pickupIndex}`,
        address: firstIncompletePickup.location_text,
        stopId: firstIncompletePickup.id,
        type: 'pickup' as const
      };
    }

    const firstIncompleteDropoff = dropoffStops.find(s => s.status !== 'COMPLETED');
    if (firstIncompleteDropoff) {
      const dropoffIndex = dropoffStops.indexOf(firstIncompleteDropoff) + 1;
      return {
        title: `Deliver Stop ${dropoffIndex}`,
        address: firstIncompleteDropoff.location_text,
        stopId: firstIncompleteDropoff.id,
        type: 'dropoff' as const
      };
    }

    if (allDropoffsDelivered) {
      return {
        title: 'Ready to Finish',
        address: 'All stops delivered',
        stopId: null,
        type: 'complete' as const
      };
    }

    return null;
  };

  const nextAction = getNextAction();

  // Check if any stops have invalid IDs
  const hasInvalidStops = stops.some(stop => !isValidUUID(stop.id));

  return (
    <>
      <div className="space-y-4">
        {/* Warning banner for invalid stop data */}
        {hasInvalidStops && (
          <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold text-amber-900 mb-1">Missing delivery stops</h4>
                <p className="text-sm text-amber-800 mb-3">
                  This job needs delivery stops created in the database. Click below to create them now.
                </p>
                <button
                  onClick={async () => {
                    setReloading(true);
                    onNotification('Creating delivery stops...', 'info');
                    try {
                      console.log('Calling edge function to create missing delivery_stops...');

                      // Call edge function to create missing delivery_stops
                      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-missing-delivery-stops`;
                      const headers = {
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                      };

                      const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ jobId })
                      });

                      const result = await response.json();

                      if (!response.ok) {
                        throw new Error(result.error || 'Failed to create stops');
                      }

                      console.log('Edge function result:', result);
                      onNotification(`${result.message}. Refreshing...`, 'success');

                      // Wait a moment then refresh the data
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      await onStopUpdate();

                      // Wait for state to update then check
                      await new Promise(resolve => setTimeout(resolve, 500));

                      onNotification('Delivery stops created successfully!', 'success');

                      // Force page reload to ensure fresh data
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                    } catch (error) {
                      console.error('Error creating delivery stops:', error);
                      onNotification(error instanceof Error ? error.message : 'Failed to create stops', 'error');
                    } finally {
                      setReloading(false);
                    }
                  }}
                  disabled={reloading}
                  className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {reloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Stops...
                    </>
                  ) : (
                    'Create Delivery Stops'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* POD Upload Section - Read-Only Stop List */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Proof of Delivery</h3>
            <p className="text-xs text-gray-600 mt-1">Upload photos or signatures as required for each stop</p>
          </div>

          {pickupStops.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                Pickups ({pickupStops.filter(s => s.status === 'COMPLETED').length}/{pickupStops.length})
              </h4>
              <div className="space-y-2">
                {pickupStops.map((stop, idx) => renderStopRow(stop, idx + 1))}
              </div>
            </div>
          )}

          {dropoffStops.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-600" />
                Dropoffs ({dropoffStops.filter(s => s.status === 'COMPLETED').length}/{dropoffStops.length})
              </h4>
              <div className="space-y-2">
                {dropoffStops.map((stop, idx) => renderStopRow(stop, idx + 1))}
              </div>
            </div>
          )}
        </div>

      </div>

      {completionModalStop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Complete Delivery Stop</h3>
              <button
                onClick={() => setCompletionModalStop(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900 mb-1">Delivery Location:</p>
                <p className="text-sm text-gray-700">{completionModalStop.location_text}</p>
              </div>

              {podRequired !== 'NONE' && (
                <>
                  {podRequired.includes('PHOTO') && (
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        Upload Proof of Delivery Photo(s) *
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        onChange={(e) => e.target.files && handleUploadPhotos(completionModalStop.id, e.target.files)}
                        disabled={uploadingPhotos}
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-white focus:outline-none p-2"
                      />
                      {uploadingPhotos && (
                        <p className="text-sm text-blue-600 mt-2 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading photos...
                        </p>
                      )}
                      {getStopPOD(completionModalStop.id)?.photo_urls && getStopPOD(completionModalStop.id)!.photo_urls.length > 0 && (
                        <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          {getStopPOD(completionModalStop.id)!.photo_urls.length} photo(s) uploaded
                        </p>
                      )}
                    </div>
                  )}

                  {podRequired.includes('SIGNATURE') && (
                    <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                      <p className="text-sm font-semibold text-yellow-900 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        E-Signature Required
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Signature capture is only available on the mobile app.
                      </p>
                      <p className="text-xs text-yellow-600 mt-2 italic">
                        For testing: You can proceed without signature by clicking Complete below.
                      </p>
                    </div>
                  )}
                </>
              )}

              <div>
                <label htmlFor="recipient" className="block text-sm font-bold text-gray-900 mb-2">
                  Recipient Name
                </label>
                <input
                  id="recipient"
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Who received the delivery?"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-bold text-gray-900 mb-2">
                  Delivery Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any special notes about this delivery?"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setCompletionModalStop(null)}
                  className="flex-1 py-2.5 px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteStop}
                  disabled={completingStop}
                  className="flex-1 py-2.5 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {completingStop ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Mark Delivered
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
