import {
  Navigation,
  MapPin,
  Phone,
  Camera,
  Package,
  CheckCircle2,
  Loader2,
  Calendar,
  AlertCircle,
  MessageCircle,
  Check,
  Truck,
  ArrowRight,
  Banknote,
  Gem,
  ShieldCheck,
  RotateCcw,
  Bike,
  ShoppingBag,
  Trash2,
  ShoppingCart,
  AlertTriangle,
  Edit,
  Clock,
  XCircle,
  Handshake,
  PackageCheck
} from 'lucide-react';
import { useState, useEffect, Fragment } from 'react';
import { DriverWizardState, DriverTask } from '../../lib/driverWizard';
import { DriverCockpitPOD } from '../../components/DriverCockpitPOD';
import { getOrCreateJobConversation } from '../../lib/messaging';
import { useAuth } from '../../contexts/AuthContext';
import { DetentionTimer } from '../../components/DetentionTimer';
import { getJobTypeInfo } from '../../lib/jobTypeUtils';
import { GeofenceArrivalButton } from '../../components/GeofenceArrivalButton';
import { DriverNavigationMap } from '../../components/DriverNavigationMap';
import { MarketplaceInspectionModal } from '../../components/MarketplaceInspectionModal';
import { supabase } from '../../lib/supabase';

interface Job {
  id: string;
  customer_offer_ttd: number;
  scheduled_pickup_time: string | null;
  proof_of_delivery_required: string | null;
  pod_stops?: any[];
  status: string;
  cash_to_return?: boolean;
  cash_to_return_amount?: number;
  cash_collection_status?: string;
  is_high_value?: boolean;
  cargo_insurance_enabled?: boolean;
  detention_fee?: number;
  return_fee?: number;
  job_type?: string;
  return_reason?: string;
  pickup_location_text?: string;
  marketplace_inspection_instructions?: string;
  marketplace_item_screenshot_url?: string;
  marketplace_inspection_status?: string;
  marketplace_inspection_photo_url?: string;
  marketplace_seller_contact?: string;
  marketplace_payment_status?: string;
  marketplace_require_inspection_photo?: boolean;
  loading_started_at?: string | null;
}

interface DetentionInfo {
  recordId: string | null;
  arrivedAt: string | null;
  vehicleType: string;
  jobBasePrice: number;
}

interface ActiveJobCardProps {
  job: Job;
  wizardState: DriverWizardState;
  updatingStatus: string | null;
  courier: any;
  podSectionRef: React.RefObject<HTMLDivElement>;
  podCollectedStops: Set<string>;
  onUpdateJobStatus: (jobId: string, status: string) => void;
  onUpdateStopStatus: (jobId: string, stopId: string, status: string, stopType: string, geofenceData?: {
    lat: number;
    lng: number;
    offline: boolean;
    badPinOverride: boolean;
    badPinPhotoFile?: File;
  }) => void;
  onSelectStop: (jobId: string, stopId: string, label: string) => Promise<void>;
  onClearSelection: (jobId: string) => Promise<void>;
  onFetchJobs: (courierId: string) => Promise<void>;
  onNotification: (message: string, type: string) => void;
  onShowCompletionModal: (data: any) => void;
  onOpenPodGate: (data: { jobId: string; stopId: string; stopAddress: string; podStop: any; podRequired: string }) => void;
  formatStatus: (status: string) => string;
  getStatusColor: (status: string) => string;
  onOpenChat?: (conversationId: string) => void;
  detentionInfo?: Record<string, DetentionInfo>;
  onReturnItem?: (jobId: string) => void;
  isCompanyDriver?: boolean;
  onBeginLoading?: (jobId: string, stopId: string) => void;
  onCargoSecured?: (jobId: string, stopId: string) => void;
}

export function ActiveJobCard({
  job,
  wizardState,
  updatingStatus,
  courier,
  podSectionRef,
  podCollectedStops,
  onUpdateJobStatus,
  onUpdateStopStatus,
  onSelectStop,
  onClearSelection,
  onFetchJobs,
  onNotification,
  onShowCompletionModal,
  onOpenPodGate,
  formatStatus,
  getStatusColor,
  onOpenChat,
  detentionInfo,
  onReturnItem,
  isCompanyDriver,
  onBeginLoading,
  onCargoSecured
}: ActiveJobCardProps) {
  const { user } = useAuth();
  const [openingChat, setOpeningChat] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [inspectionStatus, setInspectionStatus] = useState(job.marketplace_inspection_status || null);

  const isMarketplaceSafebuy = job.job_type === 'marketplace_safebuy';

  useEffect(() => {
    if (!isMarketplaceSafebuy || !inspectionStatus || inspectionStatus === 'buyer_approved' || inspectionStatus === 'buyer_rejected') return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('jobs')
        .select('marketplace_inspection_status, marketplace_inspection_photo_url')
        .eq('id', job.id)
        .maybeSingle();
      if (data && data.marketplace_inspection_status !== inspectionStatus) {
        setInspectionStatus(data.marketplace_inspection_status);
        if (data.marketplace_inspection_status === 'buyer_approved') {
          onNotification('Buyer approved the item! You can now collect it.', 'success');
        } else if (data.marketplace_inspection_status === 'buyer_rejected') {
          onNotification('Buyer rejected the item. Do not collect.', 'warning');
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isMarketplaceSafebuy, inspectionStatus, job.id]);

  const isTaskDone = (t: DriverTask) =>
    (t.type === 'PICKUP' && t.status === 'COLLECTED') ||
    (t.type === 'DROPOFF' && t.status === 'DELIVERED');

  const renderRouteProgress = () => {
    const { tasks, completedTasks, totalTasks, currentTask } = wizardState;

    const stepLabel = currentTask
      ? `Step ${tasks.findIndex(t => t.taskId === currentTask.taskId) + 1} of ${totalTasks}`
      : null;

    return (
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Route</span>
          <div className="flex items-center gap-2.5">
            {stepLabel && (
              <span className="text-[11px] text-gray-400 font-medium">{stepLabel}</span>
            )}
            <span className="text-sm font-bold text-blue-600">{completedTasks}/{totalTasks}</span>
          </div>
        </div>
        <div className="flex items-center overflow-x-auto pb-1 -mx-1 px-1">
          {tasks.map((task, i) => {
            const done = isTaskDone(task);
            const isCurrent = currentTask?.taskId === task.taskId;
            const isPickup = task.type === 'PICKUP';
            const nextDone = i < tasks.length - 1 && isTaskDone(tasks[i + 1]);

            return (
              <Fragment key={task.taskId}>
                <div className="flex flex-col items-center gap-1 flex-shrink-0" title={task.address}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                    done
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-[3px] ring-blue-200'
                      : isPickup
                      ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-200'
                      : 'bg-gray-50 text-gray-400 border-2 border-gray-200'
                  }`}>
                    {done ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : isPickup ? (
                      `P${task.index}`
                    ) : (
                      `D${task.index}`
                    )}
                  </div>
                </div>
                {i < tasks.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 min-w-[10px] rounded-full transition-all duration-300 ${
                    done && nextDone
                      ? 'bg-green-400'
                      : done
                      ? 'bg-gradient-to-r from-green-400 to-gray-200'
                      : 'bg-gray-200'
                  }`} />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStatusWorkflow = (task: DriverTask, isPickup: boolean, podComplete: boolean, podStop: any) => {
    const finalLabel = isPickup ? 'Collected' : 'Delivered';
    const steps = [
      { key: 'ENROUTE', label: 'En Route', icon: <Truck className="w-4 h-4" /> },
      { key: 'ARRIVED', label: 'Arrived', icon: <MapPin className="w-4 h-4" /> },
      { key: 'FINAL', label: finalLabel, icon: <Package className="w-4 h-4" /> }
    ];

    const statusOrder = ['NOT_STARTED', 'ENROUTE', 'ARRIVED', isPickup ? 'COLLECTED' : 'DELIVERED'];
    const currentIdx = statusOrder.indexOf(task.status);

    let nextAction: string | null = null;
    let nextLabel = '';
    let nextIcon: React.ReactNode = null;
    let isGreen = false;

    if (task.status === 'NOT_STARTED') {
      nextAction = 'ENROUTE';
      nextLabel = 'Start - En Route';
      nextIcon = <Truck className="w-5 h-5" />;
    } else if (task.status === 'ENROUTE') {
      nextAction = 'ARRIVED';
      nextLabel = 'Mark as Arrived';
      nextIcon = <MapPin className="w-5 h-5" />;
    } else if (task.status === 'ARRIVED') {
      const isLoadingFlow = isPickup && (job.status === 'arrived_waiting' || job.status === 'loading_cargo');
      if (!isLoadingFlow) {
        nextAction = isPickup ? 'COLLECTED' : 'DELIVERED';
        nextLabel = isPickup ? 'Confirm Collection' : 'Confirm Delivery';
        nextIcon = <Package className="w-5 h-5" />;
        isGreen = true;
      }
    }

    const marketplaceBlocking = false;

    const isCashJob = job.cash_to_return;
    const podRequiredForDelivery = !isPickup && task.podRequirement !== 'NONE' && !isCashJob;
    const podGateBlocking = podRequiredForDelivery && !podComplete &&
      (nextAction === 'COLLECTED' || nextAction === 'DELIVERED');

    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start justify-between">
            {steps.map((step, i) => {
              const stepIdx = i + 1;
              const isDone = currentIdx > stepIdx;
              const isActive = currentIdx === stepIdx;

              return (
                <Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-2 z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isDone
                        ? 'bg-green-500 text-white shadow-sm'
                        : isActive
                        ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-100'
                        : 'bg-gray-100 text-gray-300 border-2 border-gray-200'
                    }`}>
                      {isDone ? <Check className="w-4 h-4" /> : step.icon}
                    </div>
                    <span className={`text-[11px] font-semibold ${
                      isDone ? 'text-green-700' : isActive ? 'text-blue-700' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mt-5 mx-1.5 rounded-full transition-all duration-300 ${
                      isDone ? 'bg-green-400' : isActive ? 'bg-blue-200' : 'bg-gray-200'
                    }`} />
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>

        {nextAction && (
          <div className="px-5 pb-5">
            {marketplaceBlocking ? (
              <>
                {inspectionStatus === 'buyer_rejected' ? (
                  <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl text-center">
                    <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                    <p className="font-bold text-red-900">Buyer Rejected the Item</p>
                    <p className="text-sm text-red-700 mt-1">Do not collect. Contact the customer for next steps.</p>
                  </div>
                ) : inspectionStatus === 'inspection_submitted' ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-center">
                      <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <p className="font-bold text-amber-900">Waiting for Buyer Approval</p>
                      <p className="text-sm text-amber-700 mt-1">The buyer is reviewing your inspection photo. Please wait.</p>
                    </div>
                    <button
                      onClick={() => setShowInspectionModal(true)}
                      className="w-full py-3 bg-white border-2 border-amber-300 hover:border-amber-400 text-amber-700 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Camera className="w-4 h-4" />
                      View Inspection Details
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowInspectionModal(true)}
                    className="w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 active:scale-[0.98] bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white shadow-lg shadow-blue-600/20 animate-pulse"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Inspect Item for Buyer</span>
                  </button>
                )}
              </>
            ) : podGateBlocking ? (
              <>
                <button
                  onClick={() => {
                    if (!task.stopId) return;
                    onOpenPodGate({
                      jobId: job.id,
                      stopId: task.stopId,
                      stopAddress: task.address,
                      podStop: podStop || null,
                      podRequired: job.proof_of_delivery_required || 'NONE'
                    });
                  }}
                  className="w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 active:scale-[0.98] bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-600/20 animate-pulse"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span>Signature Required</span>
                </button>
                <p className="text-xs text-red-700 text-center mt-2.5 font-medium flex items-center justify-center gap-1.5">
                  <Edit className="w-3.5 h-3.5" />
                  Tap to collect proof of delivery
                </p>
              </>
            ) : nextAction === 'ARRIVED' && task.stopId ? (
              <GeofenceArrivalButton
                jobId={job.id}
                stopId={task.stopId}
                stopType={task.type as 'PICKUP' | 'DROPOFF'}
                targetLat={task.lat ?? null}
                targetLng={task.lng ?? null}
                onArrive={(data) => {
                  onUpdateStopStatus(job.id, data.stopId, 'ARRIVED', data.stopType, {
                    lat: data.lat,
                    lng: data.lng,
                    offline: data.offline,
                    badPinOverride: data.badPinOverride,
                    badPinPhotoFile: data.badPinPhotoFile,
                  });
                }}
              />
            ) : (
              <button
                onClick={() => {
                  if (!task.stopId) return;
                  if (nextAction === 'COLLECTED' || nextAction === 'DELIVERED') {
                    onShowCompletionModal({
                      jobId: job.id,
                      stopId: task.stopId,
                      stopAddress: task.address,
                      stopType: task.type,
                      podStop: podStop || null,
                      podRequired: job.proof_of_delivery_required || 'NONE'
                    });
                  } else {
                    onUpdateStopStatus(job.id, task.stopId, 'ENROUTE', task.type);
                  }
                }}
                className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${
                  isGreen
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-600/20'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-600/20'
                }`}
              >
                {nextIcon}
                <span>{nextLabel}</span>
                <ArrowRight className="w-4 h-4 opacity-70" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderNextActionContent = () => {
    if (wizardState.isFinished) {
      const podStops = job.pod_stops || [];
      const podStopsWithReqs = podStops.filter(p => p.required_type !== 'NONE');
      const completedPodStops = podStopsWithReqs.filter(p => {
        const rPhoto = p.required_type === 'PHOTO' || p.required_type === 'PHOTO_AND_SIGNATURE';
        const rSig = p.required_type === 'SIGNATURE' || p.required_type === 'PHOTO_AND_SIGNATURE';
        const hPhoto = p.photo_urls && p.photo_urls.length > 0;
        const hSig = !!p.signature_image_url;
        return (!rPhoto || hPhoto) && (!rSig || hSig);
      });

      const hasPodReqs = podStopsWithReqs.length > 0;
      const allPodDone = !hasPodReqs || completedPodStops.length === podStopsWithReqs.length;

      return (
        <div className="space-y-4">
          <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-9 h-9 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-900 mb-1">All Stops Completed!</h2>
                <p className="text-sm text-green-700">Tap below to complete this job</p>
              </div>
            </div>
            {hasPodReqs && (
              <div className={`mt-3 p-3 rounded-lg border ${
                allPodDone ? 'bg-green-100 border-green-300' : 'bg-amber-50 border-amber-300'
              }`}>
                <div className="flex items-center gap-2">
                  {allPodDone ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Camera className="w-4 h-4 text-amber-600" />
                  )}
                  <p className={`text-xs font-semibold ${allPodDone ? 'text-green-800' : 'text-amber-800'}`}>
                    POD: {completedPodStops.length}/{podStopsWithReqs.length} stops
                  </p>
                </div>
              </div>
            )}
            {job.cash_to_return && (
              <div className={`mt-3 p-3 rounded-lg border ${
                job.cash_collection_status === 'returned'
                  ? 'bg-green-100 border-green-300'
                  : 'bg-amber-50 border-amber-300'
              }`}>
                <div className="flex items-center gap-2">
                  <Banknote className={`w-4 h-4 ${
                    job.cash_collection_status === 'returned' ? 'text-green-600' : 'text-amber-600'
                  }`} />
                  <p className={`text-xs font-semibold ${
                    job.cash_collection_status === 'returned' ? 'text-green-800' : 'text-amber-800'
                  }`}>
                    {job.cash_collection_status === 'returned'
                      ? (isCompanyDriver ? 'Cash returned' : `Cash TTD $${(job.cash_to_return_amount || 0).toLocaleString()} returned`)
                      : job.cash_collection_status === 'collected'
                      ? (isCompanyDriver ? 'Cash collected -- must return before completing' : `Cash TTD $${(job.cash_to_return_amount || 0).toLocaleString()} -- must return before completing`)
                      : (isCompanyDriver ? 'Cash -- pending collection' : `Cash TTD $${(job.cash_to_return_amount || 0).toLocaleString()} -- pending collection`)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {hasPodReqs && !allPodDone ? (
            <button
              onClick={() => {
                const incompleteStop = podStopsWithReqs.find(p => {
                  const rPhoto = p.required_type === 'PHOTO' || p.required_type === 'PHOTO_AND_SIGNATURE';
                  const rSig = p.required_type === 'SIGNATURE' || p.required_type === 'PHOTO_AND_SIGNATURE';
                  const hPhoto = p.photo_urls && p.photo_urls.length > 0;
                  const hSig = !!p.signature_image_url;
                  return !(!rPhoto || hPhoto) || !(!rSig || hSig);
                });
                if (incompleteStop) {
                  const stop = (job as any).delivery_stops?.find((s: any) => s.id === incompleteStop.stop_id);
                  onOpenPodGate({
                    jobId: job.id,
                    stopId: incompleteStop.stop_id,
                    stopAddress: stop?.location_text || '',
                    podStop: incompleteStop,
                    podRequired: incompleteStop.required_type
                  });
                }
              }}
              className="w-full py-5 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-xl text-lg active:scale-[0.98] animate-pulse"
            >
              <AlertTriangle className="w-6 h-6" />
              <span>Signature Required</span>
            </button>
          ) : (
            <button
              onClick={() => onUpdateJobStatus(job.id, 'completed')}
              disabled={updatingStatus === job.id}
              className="w-full py-5 px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {updatingStatus === job.id ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  <span>COMPLETE JOB</span>
                </>
              )}
            </button>
          )}
        </div>
      );
    }

    if (wizardState.needsStepChoice) {
      const hasDropoffs = wizardState.eligibleDropoffs.length > 0;
      const hasPickups = wizardState.remainingPickups.length > 0;

      return (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-blue-900">Choose Next Step</h2>
                <p className="text-xs text-blue-600 mt-0.5">Deliver cargo or collect more pickups</p>
              </div>
            </div>
          </div>

          {hasDropoffs && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-700 px-1 flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-red-100 flex items-center justify-center">
                  <Package className="w-3 h-3 text-red-600" />
                </div>
                Deliver Now
              </h3>
              <div className="space-y-2">
                {wizardState.eligibleDropoffs.map((task) => (
                  <button
                    key={task.taskId}
                    onClick={() => task.stopId && onSelectStop(job.id, task.stopId, task.displayLabel)}
                    className="w-full p-4 bg-white border border-gray-200 hover:border-red-400 hover:shadow-md rounded-xl transition-all text-left active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm">
                        {task.index}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm mb-1">{task.displayLabel}</p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1.5">
                          <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                          <span className="truncate">{task.address}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {task.cargoSummary && (
                            <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                              {task.cargoSummary}
                            </span>
                          )}
                          {task.podRequirement !== 'NONE' && (
                            <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">
                              POD Required
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-red-500 transition-colors flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasPickups && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-700 px-1 flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-green-100 flex items-center justify-center">
                  <Package className="w-3 h-3 text-green-600" />
                </div>
                Collect More
              </h3>
              <div className="space-y-2">
                {wizardState.remainingPickups.map((task) => (
                  <button
                    key={task.taskId}
                    onClick={() => task.stopId && onSelectStop(job.id, task.stopId, task.displayLabel)}
                    className="w-full p-4 bg-white border border-gray-200 hover:border-green-400 hover:shadow-md rounded-xl transition-all text-left active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm">
                        P{task.index}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm mb-1">{task.displayLabel}</p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <MapPin className="w-3 h-3 text-green-500 flex-shrink-0" />
                          <span className="truncate">{task.address}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (wizardState.needsPickupSelection) {
      const availablePickups = wizardState.tasks.filter(
        t => t.type === 'PICKUP' && t.status !== 'COLLECTED'
      );

      return (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-green-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-green-900">Choose Pickup Location</h2>
                <p className="text-xs text-green-600 mt-0.5">Collect from any location first</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {availablePickups.map((task) => (
              <button
                key={task.taskId}
                onClick={() => task.stopId && onSelectStop(job.id, task.stopId, task.displayLabel)}
                className="w-full p-4 bg-white border border-gray-200 hover:border-green-400 hover:shadow-md rounded-xl transition-all text-left active:scale-[0.98] group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-sm">
                    P{task.index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm mb-1">{task.displayLabel}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <span className="truncate">{task.address}</span>
                    </div>
                    {task.contactName && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />
                        <span>{task.contactName}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                      <ArrowRight className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-[9px] font-medium text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">Start</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (wizardState.needsStopSelection) {
      const availableStops = wizardState.tasks.filter(
        t => t.type === 'DROPOFF' && t.status !== 'DELIVERED'
      );

      return (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-orange-600 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-orange-900">Choose Next Delivery Stop</h2>
                <p className="text-xs text-orange-600 mt-0.5">Deliver in any order you prefer</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {availableStops.map((task) => (
              <button
                key={task.taskId}
                onClick={() => task.stopId && onSelectStop(job.id, task.stopId, task.displayLabel)}
                className="w-full p-4 bg-white border border-gray-200 hover:border-orange-400 hover:shadow-md rounded-xl transition-all text-left active:scale-[0.98] group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-sm">
                    {task.index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm mb-1">{task.displayLabel}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <span className="truncate">{task.address}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.cargoSummary && (
                        <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium flex items-center gap-1">
                          <Package className="w-2.5 h-2.5" />
                          {task.cargoSummary}
                        </span>
                      )}
                      {task.podRequirement !== 'NONE' && (
                        <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium flex items-center gap-1">
                          <Camera className="w-2.5 h-2.5" />
                          POD Required
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                      <ArrowRight className="w-4 h-4 text-orange-500" />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (!wizardState.currentTask) return null;

    const task = wizardState.currentTask;
    const isPickup = task.type === 'PICKUP';
    const mapsUrl = task.lat && task.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${task.lat},${task.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(task.address)}`;

    const podStop = job.pod_stops?.find(pod => pod.stop_id === task.stopId);
    const needsPhoto = task.podRequirement === 'PHOTO' || task.podRequirement === 'PHOTO_AND_SIGNATURE';
    const needsSignature = task.podRequirement === 'SIGNATURE' || task.podRequirement === 'PHOTO_AND_SIGNATURE';
    const hasPhoto = podStop && podStop.photo_urls && podStop.photo_urls.length > 0;
    const hasSignature = podStop && podStop.signature_image_url;
    const podComplete = (!needsPhoto || hasPhoto) && (!needsSignature || hasSignature);

    return (
      <div className="space-y-4">
        <div className={`bg-white rounded-2xl p-5 shadow-md border border-gray-100 border-l-[5px] ${
          isPickup ? 'border-l-green-500' : 'border-l-red-500'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
              isPickup ? 'bg-green-600' : 'bg-red-600'
            }`}>
              {isPickup ? (
                <span className="text-white font-bold text-lg">P{task.index}</span>
              ) : (
                <span className="text-white font-bold text-lg">{task.index}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                Next Action
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {isPickup ? 'Collect from' : 'Deliver to'} {task.displayLabel}
              </h2>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl mb-3">
            <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              isPickup ? 'text-green-600' : 'text-red-600'
            }`} />
            <p className="text-sm text-gray-800 font-medium leading-relaxed">{task.address}</p>
          </div>

          {task.contactName && (
            <div className="flex items-center gap-2.5 p-2.5 bg-blue-50 rounded-xl mb-3">
              <Phone className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-gray-800">
                {task.contactName}
                {task.contactPhone && <span className="text-gray-500"> &middot; {task.contactPhone}</span>}
              </p>
            </div>
          )}

          {!isPickup && task.podRequirement !== 'NONE' && (
            <div className={`p-2.5 rounded-xl ${
              podComplete ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
            }`}>
              <div className="flex items-center gap-2">
                {podComplete ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-bold text-green-800">POD Complete</p>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-amber-600" />
                    <p className="text-xs font-bold text-amber-800">
                      POD Required: {task.podRequirement.replace(/_/g, ' & ')}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {task.lat && task.lng && (task.status === 'NOT_STARTED' || task.status === 'ENROUTE') && (
          <DriverNavigationMap
            destinationLat={task.lat}
            destinationLng={task.lng}
            destinationLabel={task.address}
            isReturning={job.status === 'returning'}
          />
        )}

        <div className="flex gap-2.5">
          <button
            onClick={async () => {
              if (!user || !onOpenChat || openingChat) return;
              setOpeningChat(true);
              try {
                const convId = await getOrCreateJobConversation(job.id);
                onOpenChat(convId);
              } catch (err) {
                console.error('Error opening chat:', err);
              } finally {
                setOpeningChat(false);
              }
            }}
            disabled={openingChat}
            className="flex-1 py-3.5 px-4 bg-white border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.98] disabled:opacity-70"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{openingChat ? 'Opening...' : 'Message'}</span>
          </button>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-md shadow-green-600/15 text-sm active:scale-[0.98]"
          >
            <Navigation className="w-4 h-4" />
            <span>Directions</span>
          </a>
        </div>

        {!isPickup && task.podRequirement !== 'NONE' && !podComplete && task.stopId && !job.cash_to_return && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-amber-700" />
              <p className="font-bold text-amber-900 text-sm">Upload Proof of Delivery</p>
            </div>
            <div ref={podSectionRef}>
              <DriverCockpitPOD
                jobId={job.id}
                stopId={task.stopId}
                podStop={podStop || null}
                podRequired={job.proof_of_delivery_required || 'NONE'}
                onUpdate={async () => {
                  if (courier?.id) {
                    await onFetchJobs(courier.id);
                  }
                }}
                onNotification={onNotification}
                cashCollectionStatus={job.cash_collection_status}
                hasCashToReturn={job.cash_to_return}
              />
            </div>
          </div>
        )}

        {isMarketplaceSafebuy && isPickup && (task.status === 'ARRIVED' || task.status === 'ENROUTE') && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-bold text-blue-900">Marketplace Safe-Buy</p>
            </div>
            {job.marketplace_seller_contact && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span className="text-gray-600">Seller:</span>
                <span className="font-semibold text-gray-900">{job.marketplace_seller_contact}</span>
              </div>
            )}
            {job.marketplace_payment_status && (
              <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                job.marketplace_payment_status === 'already_paid'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {job.marketplace_payment_status === 'already_paid'
                  ? 'Buyer already paid seller -- just collect the item'
                  : 'Buyer will pay after approving your inspection'}
              </div>
            )}
            {job.marketplace_inspection_instructions && (
              <div className="text-xs text-blue-800 bg-blue-100 rounded-lg p-2">
                <span className="font-bold">Inspection notes:</span> {job.marketplace_inspection_instructions}
              </div>
            )}
          </div>
        )}

        {isPickup && task.status === 'ARRIVED' && task.stopId && detentionInfo?.[task.stopId]?.arrivedAt && job.status !== 'loading_cargo' && (
          <DetentionTimer
            arrivedAt={detentionInfo[task.stopId].arrivedAt!}
            vehicleType={detentionInfo[task.stopId].vehicleType}
            jobBasePrice={detentionInfo[task.stopId].jobBasePrice}
            detentionRecordId={detentionInfo[task.stopId].recordId}
            variant="courier"
            paused={job.status === 'loading_cargo'}
            pausedAt={job.loading_started_at}
          />
        )}

        {isPickup && task.status === 'ARRIVED' && task.stopId && job.status === 'arrived_waiting' && onBeginLoading && (
          <button
            onClick={() => task.stopId && onBeginLoading(job.id, task.stopId)}
            disabled={updatingStatus === job.id}
            className="w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-xl shadow-teal-500/25 border-2 border-teal-400"
          >
            {updatingStatus === job.id ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Handshake className="w-6 h-6" />
                <span>Contact Made - Begin Loading</span>
              </>
            )}
          </button>
        )}

        {isPickup && task.status === 'ARRIVED' && task.stopId && job.status === 'loading_cargo' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border-2 border-teal-200 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center animate-pulse">
                  <PackageCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-teal-900">Loading In Progress</p>
                  <p className="text-xs text-teal-700 mt-0.5">Waiting timer paused -- take your time</p>
                </div>
              </div>
            </div>

            {isMarketplaceSafebuy && inspectionStatus !== 'buyer_approved' && (
              <>
                {inspectionStatus === 'buyer_rejected' ? (
                  <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl text-center">
                    <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                    <p className="font-bold text-red-900">Buyer Rejected the Item</p>
                    <p className="text-sm text-red-700 mt-1">Do not collect. Contact the customer for next steps.</p>
                  </div>
                ) : inspectionStatus === 'inspection_submitted' ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-center">
                      <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <p className="font-bold text-amber-900">Waiting for Buyer Approval</p>
                      <p className="text-sm text-amber-700 mt-1">The buyer is reviewing your inspection. Please wait.</p>
                    </div>
                    <button
                      onClick={() => setShowInspectionModal(true)}
                      className="w-full py-3 bg-white border-2 border-amber-300 hover:border-amber-400 text-amber-700 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Camera className="w-4 h-4" />
                      View Inspection Details
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowInspectionModal(true)}
                    className="w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 active:scale-[0.98] bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white shadow-lg shadow-blue-600/20 animate-pulse"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Inspect Item for Buyer</span>
                  </button>
                )}
              </>
            )}

            {isMarketplaceSafebuy && inspectionStatus === 'buyer_approved' && (
              <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-green-900">Buyer Approved</p>
                    <p className="text-xs text-green-700 mt-0.5">Item verified. You may now collect and proceed.</p>
                  </div>
                </div>
              </div>
            )}

            {onCargoSecured && (!isMarketplaceSafebuy || inspectionStatus === 'buyer_approved') && (
              <button
                onClick={() => task.stopId && onCargoSecured(job.id, task.stopId)}
                disabled={updatingStatus === job.id}
                className="w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-xl shadow-blue-600/25 border-2 border-blue-500"
              >
                {updatingStatus === job.id ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Truck className="w-6 h-6" />
                    <span>Cargo Secured - Start Journey</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {renderStatusWorkflow(task, isPickup, podComplete, podStop)}

        {!isPickup && job.status !== 'returning' && onReturnItem && (task.status === 'ENROUTE' || task.status === 'ARRIVED') && (
          <>
            <button
              onClick={() => setShowReturnConfirm(true)}
              className="w-full py-3.5 px-6 bg-white border-2 border-red-200 hover:border-red-400 hover:bg-red-50 text-red-600 rounded-xl font-semibold transition-all text-sm flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Delivery Failed / Return Item</span>
            </button>

            {showReturnConfirm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowReturnConfirm(false)}>
                <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in-up overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="bg-red-50 p-5 flex flex-col items-center text-center border-b border-red-100">
                    <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
                      <AlertTriangle className="w-7 h-7 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Are you sure?</h3>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                      This will mark the delivery as failed and start a return trip back to the pickup location. Only do this if the delivery cannot be completed.
                    </p>
                  </div>
                  <div className="p-4 space-y-2.5">
                    <button
                      onClick={() => {
                        setShowReturnConfirm(false);
                        onReturnItem(job.id);
                      }}
                      className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Yes, Return Item
                    </button>
                    <button
                      onClick={() => setShowReturnConfirm(false)}
                      className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-colors active:scale-[0.98]"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {wizardState.routeType === 'FLEXIBLE' && (
          <button
            onClick={() => onClearSelection(job.id)}
            className={`w-full py-3.5 px-6 bg-white border-2 hover:shadow-md rounded-xl font-semibold transition-all text-sm flex items-center justify-center gap-2 active:scale-[0.98] ${
              isPickup
                ? 'border-green-300 hover:border-green-500 hover:bg-green-50 text-green-700'
                : 'border-orange-300 hover:border-orange-500 hover:bg-orange-50 text-orange-700'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>{isPickup ? 'Change Pickup' : 'Change Destination'}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-br from-slate-50 via-blue-50/80 to-slate-50 p-5 border-b border-gray-200">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${getStatusColor(job.status)}`}>
                {formatStatus(job.status)}
              </span>
              <span className="px-2.5 py-1 bg-blue-600 text-white rounded-full text-xs font-bold shadow-sm">
                {wizardState.jobTypeLabel}
              </span>
              {(() => {
                const jt = getJobTypeInfo(job.job_type);
                const IconMap = { Package, Bike, ShoppingBag, Trash2, ShoppingCart };
                const Icon = IconMap[jt.iconName];
                return job.job_type && job.job_type !== 'standard' ? (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1 ${jt.badgeBg} ${jt.badgeText} border ${jt.badgeBorder}`}>
                    <Icon className="w-3 h-3" />
                    {jt.shortLabel}
                  </span>
                ) : null;
              })()}
              {wizardState.routeType === 'FLEXIBLE' && (
                <span className="px-2.5 py-1 bg-orange-600 text-white rounded-full text-xs font-bold shadow-sm">
                  Flexible Order
                </span>
              )}
              {job.cash_to_return && !isCompanyDriver && (
                <span className="px-2.5 py-1 bg-amber-500 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                  <Banknote className="w-3 h-3" />
                  Cash ${(job.cash_to_return_amount || 0).toLocaleString()}
                </span>
              )}
              {job.is_high_value && (
                <span className="px-2.5 py-1 bg-sky-500 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                  <Gem className="w-3 h-3" />
                  High Value
                </span>
              )}
              {job.cargo_insurance_enabled && !job.is_high_value && (
                <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Insured
                </span>
              )}
            </div>
            {job.scheduled_pickup_time && (
              <div className="flex items-center gap-1.5 text-xs bg-white px-3 py-1.5 rounded-lg shadow-sm">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-medium text-gray-700">
                  {new Date(job.scheduled_pickup_time).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
            )}
          </div>
          {!isCompanyDriver && (
            <div className="text-right bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-100">
              <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5">Earnings</div>
              <div className="text-2xl font-bold text-green-600">TTD ${(Math.round(job.customer_offer_ttd * 0.90 * 100) / 100).toFixed(2)}</div>
              {(job.detention_fee ?? 0) > 0 && (
                <div className="text-[10px] font-bold text-amber-600 mt-0.5">
                  +${job.detention_fee} wait fee
                </div>
              )}
              {(job.return_fee ?? 0) > 0 && (
                <div className="text-[10px] font-bold text-red-600 mt-0.5">
                  +${job.return_fee} return fee
                </div>
              )}
            </div>
          )}
        </div>

        {renderRouteProgress()}
      </div>

      {job.status === 'returning' && (() => {
        const returnAddress = job.pickup_location_text || 'Original pickup point';
        const currentTask = wizardState.currentTask;
        const returnLat = currentTask?.lat;
        const returnLng = currentTask?.lng;
        const returnMapsUrl = returnLat && returnLng
          ? `https://www.google.com/maps/dir/?api=1&destination=${returnLat},${returnLng}`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(returnAddress)}`;

        return (
          <div className="mx-5 mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0 animate-pulse">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-red-900 text-sm">Return Trip Active</p>
                <p className="text-xs text-red-700 mt-0.5">
                  {job.return_reason === 'customer_refused' && 'Customer refused item'}
                  {job.return_reason === 'item_does_not_fit' && 'Item does not fit'}
                  {job.return_reason === 'wrong_address_unavailable' && 'Wrong address / unavailable'}
                  {job.return_reason === 'item_damaged' && 'Item damaged on arrival'}
                  {!job.return_reason && 'Delivery unsuccessful'}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 mb-3 border border-red-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Return destination</p>
                  <p className="text-sm text-gray-800 font-medium">{returnAddress}</p>
                </div>
              </div>
            </div>
            <a
              href={returnMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              <Navigation className="w-4 h-4" />
              Navigate to Return Location
            </a>
          </div>
        );
      })()}

      <div className="p-5">
        {renderNextActionContent()}
      </div>

      {showInspectionModal && isMarketplaceSafebuy && (
        <MarketplaceInspectionModal
          jobId={job.id}
          inspectionInstructions={job.marketplace_inspection_instructions || null}
          itemScreenshotUrl={job.marketplace_item_screenshot_url || null}
          inspectionStatus={inspectionStatus || null}
          inspectionPhotoUrl={job.marketplace_inspection_photo_url || null}
          sellerContact={job.marketplace_seller_contact || null}
          paymentStatus={job.marketplace_payment_status || null}
          requirePhoto={job.marketplace_require_inspection_photo || false}
          onClose={() => setShowInspectionModal(false)}
          onStatusUpdate={async () => {
            const { data } = await supabase
              .from('jobs')
              .select('marketplace_inspection_status, marketplace_inspection_photo_url')
              .eq('id', job.id)
              .maybeSingle();
            if (data) {
              setInspectionStatus(data.marketplace_inspection_status);
            }
            if (courier?.id) {
              await onFetchJobs(courier.id);
            }
          }}
        />
      )}
    </div>
  );
}
