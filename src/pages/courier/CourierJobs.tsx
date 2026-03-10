import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Clock, MapPin, Package, Send, Loader2, Filter, Zap, Calendar, CheckCircle2, TrendingUp, Scale, Truck, Camera, Navigation, Phone, MessageCircle, Info, CheckCircle, AlertTriangle, Building2, Shield, Dumbbell, Lock, Layers, DollarSign, Banknote, Gem, ShieldCheck, Bike, ShoppingBag, Trash2, ShoppingCart } from 'lucide-react';
import { getJobTypeInfo, ALL_JOB_TYPES, type JobType as JobTypeEnum } from '../../lib/jobTypeUtils';
import { Database } from '../../lib/database.types';
import { NotificationToast } from '../../components/NotificationToast';
import { AddBankAccountModal } from '../../components/AddBankAccountModal';
import { DeliveryProofModal } from '../../components/DeliveryProofModal';
import { AcceptJobModal } from '../../components/AcceptJobModal';
import { CounterOfferModal } from '../../components/CounterOfferModal';
import { RetailMultiStopDelivery } from '../../components/RetailMultiStopDelivery';
import { DriverCockpitPOD } from '../../components/DriverCockpitPOD';
import { DeliveryCompletionModal } from '../../components/DeliveryCompletionModal';
import { SaveLocationModal } from '../../components/SaveLocationModal';
import { formatMinutesToHoursMinutes, parseHoursMinutesToMinutes } from '../../lib/timeUtils';
import { buildRouteFromJob } from '../../lib/jobRoute';
import { getNextNavigationTarget, getAvailableStopOptions, generateGoogleMapsUrl, getCurrentStep, CurrentStep } from '../../lib/jobNavigation';
import { buildDriverWizardState, DriverWizardState } from '../../lib/driverWizard';
import { isTrackingActive } from '../../lib/trackingUtils';
import { ActiveJobCard } from './CourierJobsActiveCard';
import { findBackhaulMatches } from '../../lib/backhaulMatching';
import { BackhaulOpportunityAlert } from '../../components/BackhaulOpportunityAlert';
import { ChatView } from '../../components/messaging/ChatView';
import { CashConfirmationModal } from '../../components/CashConfirmationModal';
import { CashReturnBanner } from '../../components/CashReturnBanner';
import { CashDeliveryModal } from '../../components/CashDeliveryModal';
import {
  createDetentionRecord,
  finalizeDetention,
  getMinutesSinceArrival,
  getActiveDetentionRecord,
} from '../../lib/detentionFees';
import {
  getOfflineQueue,
  removeFromOfflineQueue,
} from '../../lib/geofence';
import { ReturnItemModal } from '../../components/ReturnItemModal';
import type { ReturnReason } from '../../components/ReturnItemModal';
import { PodGateModal } from '../../components/PodGateModal';
import { isMobileDevice } from '../../lib/deviceDetection';

type Job = Database['public']['Tables']['jobs']['Row'];
type Courier = Database['public']['Tables']['couriers']['Row'];
type Bid = Database['public']['Tables']['bids']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type CargoItem = Database['public']['Tables']['cargo_items']['Row'];
type CounterOffer = Database['public']['Tables']['counter_offers']['Row'];

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

interface JobWithBidInfo extends Job {
  myBid?: Bid;
  totalBids?: number;
  myCounterOffer?: CounterOffer;
  totalCounterOffers?: number;
  cargo_items?: CargoItem[];
  hasNewCustomerCounterOffer?: boolean;
  latestCustomerCounterOfferId?: string;
  customer_profile?: Profile;
  delivery_stops?: DeliveryStop[];
}

interface JobWithCustomer extends Job {
  customer_profile?: Profile;
  cargo_items?: CargoItem[];
  delivery_stops?: DeliveryStop[];
  pod_stops?: PODStop[];
}

interface CourierJobsProps {
  onNavigate: (path: string) => void;
}

type TabType = 'available' | 'bids' | 'active' | 'completed';

type FilterType = 'all' | 'near_me' | 'highest_price' | 'bids_only' | 'big_cargo' | 'courier' | 'marketplace_safebuy' | 'junk_removal' | 'standard';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

export function CourierJobs({ onNavigate }: CourierJobsProps) {
  const { user, profile } = useAuth();
  const isCompanyDriver = !!(profile as any)?.is_company_driver;

  const getInitialTab = (): TabType => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (isCompanyDriver) {
      if (tabParam === 'active' || tabParam === 'completed') return tabParam;
      return 'active';
    }
    if (tabParam === 'available' || tabParam === 'bids' || tabParam === 'active' || tabParam === 'completed') {
      return tabParam;
    }
    return 'available';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());
  const [courier, setCourier] = useState<Courier | null>(null);
  const [availableJobs, setAvailableJobs] = useState<JobWithBidInfo[]>([]);
  const [biddedJobs, setBiddedJobs] = useState<JobWithBidInfo[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobWithCustomer[]>([]);
  const [completedJobs, setCompletedJobs] = useState<JobWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabsLoaded, setTabsLoaded] = useState<Record<TabType, boolean>>({
    available: false,
    bids: false,
    active: false,
    completed: false
  });
  const [biddingJob, setBiddingJob] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidEta, setBidEta] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bankVerified, setBankVerified] = useState(false);
  const [hasBankInfo, setHasBankInfo] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [checkingBank, setCheckingBank] = useState(true);
  const [showDeliveryProofModal, setShowDeliveryProofModal] = useState(false);
  const [selectedCargoItem, setSelectedCargoItem] = useState<{jobId: string; cargoItemId: string; description: string} | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [courierLocation, setCourierLocation] = useState<{lat: number; lng: number} | null>(null);
  const [showAcceptJobModal, setShowAcceptJobModal] = useState(false);
  const [showCounterOfferModal, setShowCounterOfferModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithBidInfo | null>(null);
  const [acceptingJob, setAcceptingJob] = useState(false);
  const [showStopSelector, setShowStopSelector] = useState(false);
  const [selectingStopForJob, setSelectingStopForJob] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionModalData, setCompletionModalData] = useState<{
    jobId: string;
    stopId: string;
    stopAddress: string;
    stopType: 'PICKUP' | 'DROPOFF';
    podStop: PODStop | null;
    podRequired: string;
  } | null>(null);
  const [showSaveLocationModal, setShowSaveLocationModal] = useState(false);
  const [saveLocationData, setSaveLocationData] = useState<{
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [backhaulModalMatch, setBackhaulModalMatch] = useState<{
    job: { id: string; pickup_location_text: string; dropoff_location_text: string; price_ttd: number; cargo_size_category?: string };
    distanceToPickup: number;
    distanceFromDropoff: number;
    estimatedFuelCost: number;
    netProfit: number;
  } | null>(null);

  const [showCashConfirmModal, setShowCashConfirmModal] = useState(false);
  const [cashConfirmJobId, setCashConfirmJobId] = useState<string | null>(null);
  const [cashConfirmAmount, setCashConfirmAmount] = useState(0);
  const [showCashDeliveryModal, setShowCashDeliveryModal] = useState(false);
  const [cashDeliveryData, setCashDeliveryData] = useState<{
    jobId: string;
    stopId: string;
    stopAddress: string;
    cashAmount: number;
    podRequired: string;
    podStopId?: string;
  } | null>(null);
  const [cashReturnJobs, setCashReturnJobs] = useState<Array<{
    id: string;
    cash_to_return_amount: number;
    cash_collection_status: string;
    pickup_location_text: string;
    customer_user_id: string;
  }>>([]);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnModalJobId, setReturnModalJobId] = useState<string | null>(null);

  const [showPodGateModal, setShowPodGateModal] = useState(false);
  const [podGateData, setPodGateData] = useState<{
    jobId: string;
    stopId: string;
    stopAddress: string;
    podStop: PODStop | null;
    podRequired: string;
  } | null>(null);
  const [podCollectedStops, setPodCollectedStops] = useState<Set<string>>(new Set());

  const podSectionRef = useRef<HTMLDivElement>(null);
  const podGateTriggeredRef = useRef<Set<string>>(new Set());

  const [detentionRecords, setDetentionRecords] = useState<Record<string, {
    recordId: string | null;
    arrivedAt: string | null;
    vehicleType: string;
    jobBasePrice: number;
  }>>({});

  useEffect(() => {
    if (activeJobs.length === 0) return;

    const loadDetentionRecords = async () => {
      const records: typeof detentionRecords = {};
      for (const job of activeJobs) {
        const stops = job.delivery_stops || [];
        const arrivedPickups = stops.filter(
          (s: DeliveryStop) => s.stop_type === 'PICKUP' && s.status === 'ARRIVED' && s.arrived_at
        );

        for (const stop of arrivedPickups) {
          const existing = await getActiveDetentionRecord(job.id, stop.id);
          if (existing) {
            records[stop.id] = {
              recordId: existing.id,
              arrivedAt: existing.arrived_at,
              vehicleType: existing.vehicle_type,
              jobBasePrice: existing.job_base_price,
            };
          }
        }
      }
      if (Object.keys(records).length > 0) {
        setDetentionRecords(prev => ({ ...prev, ...records }));
      }
    };

    loadDetentionRecords();
  }, [activeJobs]);

  useEffect(() => {
    if (showPodGateModal || showCashDeliveryModal || showCompletionModal) return;

    for (const job of activeJobs) {
      const podReq = (job as any).proof_of_delivery_required || 'NONE';
      if (podReq === 'NONE' || (job as any).cash_to_return) continue;

      const stops = job.delivery_stops || [];
      for (const stop of stops) {
        if (stop.stop_type !== 'DROPOFF' || stop.status !== 'ARRIVED') continue;
        if (podCollectedStops.has(stop.id)) continue;
        if (podGateTriggeredRef.current.has(stop.id)) continue;

        const existingPodStop = (job as any).pod_stops?.find((p: any) => p.stop_id === stop.id);
        const needsPhoto = podReq === 'PHOTO' || podReq === 'PHOTO_AND_SIGNATURE';
        const needsSignature = podReq === 'SIGNATURE' || podReq === 'PHOTO_AND_SIGNATURE';
        const hasPhoto = existingPodStop?.photo_urls?.length > 0;
        const hasSignature = !!existingPodStop?.signature_image_url;
        const podComplete = (!needsPhoto || hasPhoto) && (!needsSignature || hasSignature);

        if (podComplete) {
          setPodCollectedStops(prev => new Set(prev).add(stop.id));
          continue;
        }

        podGateTriggeredRef.current.add(stop.id);
        setPodGateData({
          jobId: job.id,
          stopId: stop.id,
          stopAddress: stop.location_text || '',
          podStop: existingPodStop || null,
          podRequired: podReq,
        });
        setShowPodGateModal(true);
        return;
      }
    }
  }, [activeJobs, showPodGateModal, showCashDeliveryModal, showCompletionModal, podCollectedStops]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'available' || tabParam === 'bids' || tabParam === 'active' || tabParam === 'completed') {
      setActiveTab(tabParam);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCourierLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Could not get courier location:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    fetchCourierAndJobs();

    const channel = supabase
      .channel('courier-bids')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bids' },
        () => {
          // Mark tab as not loaded so it refreshes
          setTabsLoaded(prev => ({ ...prev, [activeTab]: false }));
          if (courier) {
            fetchJobs(courier.id, activeTab);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, courier?.id]);

  useEffect(() => {
    let watchId: number | null = null;
    let lastSentLocation: { lat: number; lng: number } | null = null;
    let lastSentTime = 0;
    let pendingUpdate: NodeJS.Timeout | null = null;

    const jobsWithActiveTracking = activeJobs.filter(job => isTrackingActive(job));

    if (jobsWithActiveTracking.length > 0 && navigator.geolocation && user?.id) {
      const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const sendUpdate = async (position: GeolocationPosition) => {
        const now = Date.now();
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const movedEnough = !lastSentLocation ||
          haversineMeters(lastSentLocation.lat, lastSentLocation.lng, lat, lng) >= 15;
        const timeElapsed = now - lastSentTime >= 5000;

        if (!movedEnough && !timeElapsed) {
          if (!pendingUpdate) {
            const delay = 5000 - (now - lastSentTime);
            pendingUpdate = setTimeout(() => {
              pendingUpdate = null;
              sendUpdate(position);
            }, delay);
          }
          return;
        }

        if (!movedEnough) return;

        lastSentLocation = { lat, lng };
        lastSentTime = now;

        for (const job of jobsWithActiveTracking) {
          try {
            await supabase
              .from('job_driver_location_current')
              .upsert({
                job_id: job.id,
                driver_user_id: user.id,
                lat,
                lng,
                heading: position.coords.heading ?? undefined,
                speed: position.coords.speed ?? undefined,
                accuracy: position.coords.accuracy ?? undefined,
                updated_at: new Date().toISOString()
              }, { onConflict: 'job_id' });
          } catch (error) {
            console.error('Error updating location:', error);
          }
        }
      };

      watchId = navigator.geolocation.watchPosition(
        (position) => { sendUpdate(position); },
        (error) => { console.warn('Location tracking error:', error.message); },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (pendingUpdate) clearTimeout(pendingUpdate);
    };
  }, [activeJobs, user?.id]);

  useEffect(() => {
    const flushOfflineQueue = async () => {
      const queue = getOfflineQueue();
      if (queue.length === 0) return;

      for (const item of queue) {
        try {
          const { error } = await supabase
            .from('delivery_stops')
            .update({
              status: item.status,
              arrived_at: item.timestamp,
              arrived_lat: item.lat,
              arrived_lng: item.lng,
              offline_arrival: true,
              offline_arrival_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.stopId);

          if (!error) {
            removeFromOfflineQueue(item.jobId, item.stopId);

            if (item.stopType === 'PICKUP') {
              const vehicleType = courier?.vehicle_type || 'car';
              const job = activeJobs.find(j => j.id === item.jobId);
              const jobBasePrice = (job as any)?.base_price || (job as any)?.customer_offer_ttd || 0;
              await createDetentionRecord(item.jobId, item.stopId, item.timestamp, vehicleType, jobBasePrice);
            }

            addNotification('Offline arrival synced successfully', 'success');
          }
        } catch (err) {
          console.error('Failed to sync offline arrival:', err);
        }
      }

      if (courier?.id) {
        fetchJobs(courier.id, 'active', true);
      }
    };

    const handleOnline = () => {
      flushOfflineQueue();
    };

    window.addEventListener('online', handleOnline);

    if (navigator.onLine) {
      flushOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [courier?.id, activeJobs]);

  const fetchCourierAndJobs = async () => {
    try {
      const isHaulageCompany = profile?.role === 'business' && profile?.business_type === 'haulage';

      console.log('🚚 Fetching courier and jobs...');
      console.log('   - Is haulage company?', isHaulageCompany);
      console.log('   - Profile role:', profile?.role);
      console.log('   - Business type:', profile?.business_type);

      let courierData = null;

      const { data, error: courierError } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (courierError) throw courierError;

      if (data) {
        courierData = data;
        setCourier(data);
      } else if (isHaulageCompany) {
        const { data: newCourier, error: insertError } = await supabase
          .from('couriers')
          .insert({
            user_id: user!.id,
            vehicle_type: 'fleet',
            vehicle_make: 'Haulage Fleet',
            vehicle_model: 'Multiple Vehicles',
            vehicle_year: new Date().getFullYear(),
            vehicle_plate: 'FLEET',
          })
          .select()
          .single();

        if (insertError) throw insertError;
        courierData = newCourier;
        setCourier(newCourier);
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('courier_bank_verified, courier_bank_name')
        .eq('id', user!.id)
        .single();

      if (profileError) throw profileError;

      setBankVerified(profileData?.courier_bank_verified || false);
      setHasBankInfo(!!profileData?.courier_bank_name);
      setCheckingBank(false);

      // Set loading to false immediately after courier data is ready
      setLoading(false);

      // Fetch jobs for the initial tab in background
      if (courierData) {
        fetchJobs(courierData.id, activeTab);
        fetchCashReturnJobs();
      }
    } catch (error) {
      console.error('Error fetching courier:', error);
      setCheckingBank(false);
      setLoading(false);
    }
  };

  const fetchCashReturnJobs = async () => {
    try {
      if (!courier) return;
      const { data, error } = await supabase
        .from('jobs')
        .select('id, cash_to_return_amount, cash_collection_status, pickup_location_text, customer_user_id')
        .eq('assigned_courier_id', courier.id)
        .eq('cash_to_return', true)
        .eq('cash_collection_status', 'collected');

      if (error) throw error;
      setCashReturnJobs(data || []);
    } catch (error) {
      console.error('Error fetching cash return jobs:', error);
    }
  };

  // Load data when tab changes
  useEffect(() => {
    if (courier && !loading && !tabsLoaded[activeTab]) {
      // Don't set loading=true when switching tabs - just fetch in background
      fetchJobs(courier.id, activeTab);
    }
  }, [activeTab]);

  const addNotification = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const fetchJobs = async (courierId?: string, tabToLoad?: TabType, forceRefresh?: boolean) => {
    try {
      const activeCourterId = courierId || courier?.id;
      if (!activeCourterId) return;

      const isHaulageCompany = profile?.role === 'business' && profile?.business_type === 'haulage';
      const targetTab = tabToLoad || activeTab;

      console.log(`🔄 Fetching data for tab: ${targetTab}, force: ${forceRefresh}`);

      let allJobs: JobWithBidInfo[] = [];
      if (!isCompanyDriver && (targetTab === 'available' || targetTab === 'bids') && (forceRefresh || !tabsLoaded[targetTab])) {
        const { data: allJobsRaw, error } = await supabase
          .from('jobs')
          .select(`
            *,
            cargo_items(*),
            customer_profile:profiles!jobs_customer_user_id_fkey(*)
          `)
          .in('status', ['open', 'bidding'])
          .order('created_at', { ascending: false });

        if (error) throw error;

        console.log('📦 Fetched jobs from database:', allJobsRaw?.length || 0, 'jobs');

        // No need to fetch delivery_stops for available/bidding jobs - we don't display them
        allJobs = (allJobsRaw || []).map(job => ({
          ...job,
          delivery_stops: []
        } as JobWithBidInfo));
      }

      // STEP 2: Fetch active jobs - only if viewing active tab
      let myActiveJobs: any[] = [];
      let didFetchActive = false;
      if (targetTab === 'active' && (forceRefresh || !tabsLoaded.active)) {
        didFetchActive = true;
        if (isHaulageCompany) {
          console.log('🚚 Fetching haulage company jobs for company:', user!.id);

          const { data, error: activeError } = await supabase
            .from('jobs')
            .select(`
              *,
              customer_profile:profiles!jobs_customer_user_id_fkey(*),
              cargo_items(*)
            `)
            .eq('assigned_company_id', user!.id)
            .in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'returning'])
            .order('updated_at', { ascending: false });

          if (activeError) {
            console.error('❌ Error fetching haulage jobs:', activeError);
            throw activeError;
          }

          console.log('✅ Found haulage company jobs:', data?.length || 0);
          myActiveJobs = data || [];
        } else {
          // Regular courier - get jobs assigned to them
          const { data, error: activeError } = await supabase
            .from('jobs')
            .select(`
              *,
              customer_profile:profiles!jobs_customer_user_id_fkey(*),
              cargo_items(*)
            `)
            .eq('assigned_courier_id', activeCourterId)
            .in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'returning'])
            .order('updated_at', { ascending: false });

          if (activeError) throw activeError;
          myActiveJobs = data || [];
        }
      }

      // Batch fetch all delivery_stops and pod_stops for active jobs in 2 queries instead of N queries
      const jobIds = (myActiveJobs || []).map(j => j.id);

      let allStopsMap = new Map<string, DeliveryStop[]>();
      let allPodStopsMap = new Map<string, PODStop[]>();

      if (jobIds.length > 0 && targetTab === 'active') {
        // Fetch all delivery stops in one query
        const { data: allStops } = await supabase
          .from('delivery_stops')
          .select('*')
          .in('job_id', jobIds)
          .order('stop_index', { ascending: true });

        // Fetch all POD stops in one query
        const { data: allPodStops } = await supabase
          .from('pod_stops')
          .select('*')
          .in('job_id', jobIds);

        // Group stops by job_id
        (allStops || []).forEach(stop => {
          if (!allStopsMap.has(stop.job_id)) {
            allStopsMap.set(stop.job_id, []);
          }
          allStopsMap.get(stop.job_id)!.push(stop);
        });

        // Group POD stops by job_id
        (allPodStops || []).forEach(podStop => {
          if (!allPodStopsMap.has(podStop.job_id)) {
            allPodStopsMap.set(podStop.job_id, []);
          }
          allPodStopsMap.get(podStop.job_id)!.push(podStop);
        });
      }

      const jobsWithStops: JobWithCustomer[] = [];
      if (targetTab === 'active' && didFetchActive) {
        for (const job of (myActiveJobs || [])) {
          const deliveryStops = allStopsMap.get(job.id) || [];
          let podStops = allPodStopsMap.get(job.id) || [];

          let tempDeliveryStops: DeliveryStop[] = deliveryStops;

          if (deliveryStops.length === 0) {
            const route = buildRouteFromJob(job);
            const stopsToCreate = [
              ...route.pickups.map((p, idx) => ({
                job_id: job.id,
                stop_index: idx,
                stop_type: 'PICKUP' as const,
                location_text: p.address,
                location_lat: p.lat,
                location_lng: p.lng,
                status: 'NOT_STARTED' as const
              })),
              ...route.dropoffs.map((d, idx) => ({
                job_id: job.id,
                stop_index: route.pickups.length + idx,
                stop_type: 'DROPOFF' as const,
                location_text: d.address,
                location_lat: d.lat,
                location_lng: d.lng,
                status: 'NOT_STARTED' as const
              }))
            ];

            if (stopsToCreate.length > 0) {
              const { data: insertedStops, error: insertError } = await supabase
                .from('delivery_stops')
                .insert(stopsToCreate)
                .select();

              if (!insertError && insertedStops) {
                tempDeliveryStops = insertedStops;
              } else if (insertError?.code === '23505') {
                const { data: existingStops } = await supabase
                  .from('delivery_stops')
                  .select('*')
                  .eq('job_id', job.id)
                  .order('stop_index', { ascending: true });
                tempDeliveryStops = existingStops || [];
              }

              if (tempDeliveryStops.length > 0 && podStops.length === 0 &&
                  job.proof_of_delivery_required && job.proof_of_delivery_required !== 'NONE') {
                const dropoffStopsForPod = tempDeliveryStops.filter(s => s.stop_type === 'DROPOFF');
                if (dropoffStopsForPod.length > 0) {
                  const podStopsToCreate = dropoffStopsForPod.map(stop => ({
                    stop_id: stop.id,
                    job_id: job.id,
                    required_type: job.proof_of_delivery_required!,
                    status: 'REQUIRED' as const
                  }));

                  const { data: insertedPods, error: podError } = await supabase
                    .from('pod_stops')
                    .insert(podStopsToCreate)
                    .select();

                  if (!podError && insertedPods) {
                    podStops = insertedPods;
                  } else if (podError) {
                    const { data: existingPods } = await supabase
                      .from('pod_stops')
                      .select('*')
                      .eq('job_id', job.id);
                    if (existingPods) {
                      podStops = existingPods;
                    }
                  }
                }
              }
            }
          }

          jobsWithStops.push({
            ...job,
            delivery_stops: tempDeliveryStops,
            pod_stops: podStops
          } as JobWithCustomer);
        }

        setActiveJobs(jobsWithStops);
      }

      // STEP 3: Fetch completed jobs - only if viewing completed tab
      let myCompletedJobs = [];
      if (targetTab === 'completed' && (forceRefresh || !tabsLoaded.completed)) {
        if (isHaulageCompany) {
          const { data: drivers } = await supabase
            .from('haulage_drivers')
            .select('id')
            .eq('company_id', user!.id);

          const driverIds = drivers?.map(d => d.id) || [];

          // Only fetch completed jobs if there are drivers
          if (driverIds.length > 0) {
            const { data, error: completedError } = await supabase
              .from('jobs')
              .select(`
                *,
                customer_profile:profiles!jobs_customer_user_id_fkey(*)
              `)
              .in('assigned_courier_id', driverIds)
              .eq('status', 'completed')
              .order('updated_at', { ascending: false })
              .limit(20);

            if (completedError) throw completedError;
            myCompletedJobs = data || [];
          }
        } else {
          const { data, error: completedError } = await supabase
            .from('jobs')
            .select(`
              *,
              customer_profile:profiles!jobs_customer_user_id_fkey(*)
            `)
            .eq('assigned_courier_id', activeCourterId)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false })
            .limit(20);

          if (completedError) throw completedError;
          myCompletedJobs = data || [];
        }
        setCompletedJobs(myCompletedJobs as JobWithCustomer[] || []);
      }

      // STEP 4: Fetch bids and counter offers - only for available/bids tabs
      let myBids = [];
      let allBidsCount: any[] = [];
      let myCounterOffers: any[] = [];
      let allCounterOffersCount: any[] = [];
      let allCounterOffers: any[] = [];

      if ((targetTab === 'available' || targetTab === 'bids') && (forceRefresh || !tabsLoaded[targetTab])) {
        if (isHaulageCompany) {
          // For haulage companies, all jobs are available (no bidding)
          console.log('🚚 Processing', allJobs?.length || 0, 'jobs for haulage company');

          const courierRating = (profile as any)?.rating_average || 0;
          const available: JobWithBidInfo[] = allJobs
            .filter(job => !(job as any).is_high_value || courierRating >= 4.8)
            .map(job => ({
              ...job,
              myBid: undefined,
              totalBids: 0,
              myCounterOffer: undefined,
              totalCounterOffers: 0,
              hasNewCustomerCounterOffer: false,
              latestCustomerCounterOfferId: undefined,
            }));

          console.log('✅ Available jobs for haulage:', available.length);

          setAvailableJobs(available);
          setBiddedJobs([]);
        } else {
          // Regular couriers - fetch bids and counter offers
          // Parallelize these queries since they're independent
          const [bidsResult, bidsCountResult, counterOffersResult, counterOffersCountResult, allCounterOffersResult] = await Promise.all([
            supabase.from('bids').select('*').eq('courier_id', activeCourterId),
            supabase.from('bids').select('id, job_id'),
            supabase.from('counter_offers').select('*').eq('courier_id', activeCourterId),
            supabase.from('counter_offers').select('id, job_id'),
            supabase.from('counter_offers').select('*').eq('courier_id', activeCourterId).order('created_at', { ascending: false })
          ]);

          if (bidsResult.error) throw bidsResult.error;
          if (bidsCountResult.error) throw bidsCountResult.error;
          if (counterOffersResult.error) throw counterOffersResult.error;
          if (counterOffersCountResult.error) throw counterOffersCountResult.error;
          if (allCounterOffersResult.error) throw allCounterOffersResult.error;

          myBids = bidsResult.data || [];
          allBidsCount = bidsCountResult.data || [];
          myCounterOffers = counterOffersResult.data || [];
          allCounterOffersCount = counterOffersCountResult.data || [];
          allCounterOffers = allCounterOffersResult.data || [];

          const bidCountMap: Record<string, number> = {};
          allBidsCount?.forEach(bid => {
            bidCountMap[bid.job_id] = (bidCountMap[bid.job_id] || 0) + 1;
          });

          const counterOfferCountMap: Record<string, number> = {};
          allCounterOffersCount?.forEach(offer => {
            counterOfferCountMap[offer.job_id] = (counterOfferCountMap[offer.job_id] || 0) + 1;
          });

          const myBidsMap = new Map(myBids?.map(bid => [bid.job_id, bid]) || []);
          const myCounterOffersMap = new Map(myCounterOffers?.map(offer => [offer.job_id, offer]) || []);

          const newCustomerCounterOffers = new Map<string, string>();
          allCounterOffers?.forEach(offer => {
            if ((offer.offered_by_role === 'customer' || offer.offered_by_role === 'business') &&
                offer.status === 'pending') {
              if (!newCustomerCounterOffers.has(offer.job_id)) {
                newCustomerCounterOffers.set(offer.job_id, offer.id);
              }
            }
          });

          const available: JobWithBidInfo[] = [];
          const bidded: JobWithBidInfo[] = [];

          console.log('🔍 Processing', allJobs?.length || 0, 'jobs for display');
          console.log('📋 My bids:', myBids?.length || 0);
          console.log('💬 My counter offers:', myCounterOffers?.length || 0);

          const courierRating = (profile as any)?.rating_average || 0;
          allJobs?.forEach(job => {
            const myOffer = myCounterOffersMap.get(job.id);
            const hasNewCustomerCounter = myOffer?.status === 'countered' && newCustomerCounterOffers.has(job.id);

            const jobWithInfo: JobWithBidInfo = {
              ...job,
              myBid: myBidsMap.get(job.id),
              totalBids: bidCountMap[job.id] || 0,
              myCounterOffer: myOffer,
              totalCounterOffers: counterOfferCountMap[job.id] || 0,
              hasNewCustomerCounterOffer: hasNewCustomerCounter,
              latestCustomerCounterOfferId: hasNewCustomerCounter ? newCustomerCounterOffers.get(job.id) : undefined,
            };

            if (myBidsMap.has(job.id) || myCounterOffersMap.has(job.id)) {
              bidded.push(jobWithInfo);
            } else if ((job as any).is_high_value && courierRating < 4.8) {
              // Skip high-value jobs for drivers below 4.8 stars
            } else {
              available.push(jobWithInfo);
            }
          });

          console.log('✅ Available jobs:', available.length);
          console.log('📝 Bidded jobs:', bidded.length);

          setAvailableJobs(available);
          setBiddedJobs(bidded);
        }
      }

      // Mark the current tab as loaded
      setTabsLoaded(prev => ({ ...prev, [targetTab]: true }));

      console.log(`✅ Finished loading tab: ${targetTab}`);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setLoading(false);
    }
  };

  const submitBid = async (jobId: string) => {
    if (!hasBankInfo) {
      setShowBankModal(true);
      return;
    }

    if (!bankVerified) {
      addNotification('Your bank account must be verified by admin before you can bid on jobs.', 'warning');
      return;
    }

    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      addNotification('Please enter a valid bid amount', 'warning');
      return;
    }

    if (!courier?.id) {
      addNotification('Courier information not found. Please refresh the page.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { error: bidError } = await supabase
        .from('bids')
        .insert({
          job_id: jobId,
          courier_id: courier.id,
          amount_ttd: parseFloat(bidAmount),
          eta_minutes: bidEta ? parseHoursMinutesToMinutes(bidEta) : null,
          message: bidMessage || null,
          status: 'active',
        });

      if (bidError) {
        console.error('Bid insertion error:', bidError);
        throw bidError;
      }

      const { error: jobError } = await supabase
        .from('jobs')
        .update({ status: 'bidding' })
        .eq('id', jobId);

      if (jobError) {
        console.error('Job update error:', jobError);
      }

      setBiddingJob(null);
      setBidAmount('');
      setBidMessage('');
      setBidEta('');

      addNotification('Bid submitted successfully!', 'success');
      fetchJobs();
    } catch (error: unknown) {
      console.error('Bid submission error:', error);
      if (error instanceof Error) {
        addNotification(`Failed to submit bid: ${error.message}`, 'warning');
      } else {
        addNotification('Failed to submit bid. Please check your permissions and try again.', 'warning');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const acceptJob = async () => {
    const isHaulageCompany = profile?.role === 'business' && profile?.business_type === 'haulage';

    if (!isHaulageCompany && !isMobileDevice()) {
      addNotification('You must use a mobile device to accept jobs. GPS tracking and real-time updates require mobile access.', 'warning');
      setShowAcceptJobModal(false);
      return;
    }

    if (cashReturnJobs.length > 0) {
      addNotification('You cannot accept new jobs while holding unreturned cash. Please return all cash first.', 'warning');
      setShowAcceptJobModal(false);
      return;
    }

    if (!isHaulageCompany && !hasBankInfo) {
      setShowBankModal(true);
      setShowAcceptJobModal(false);
      return;
    }

    if (!isHaulageCompany && !bankVerified) {
      addNotification('Your bank account must be verified by admin before you can accept jobs.', 'warning');
      setShowAcceptJobModal(false);
      return;
    }

    if (!isHaulageCompany && !courier?.id) {
      addNotification('Courier information not found. Please refresh the page.', 'warning');
      return;
    }

    if (!selectedJob) {
      addNotification('No job selected.', 'warning');
      return;
    }

    setAcceptingJob(true);
    try {
      if (isHaulageCompany) {
        addNotification('Job accepted successfully!', 'success');
        setShowAcceptJobModal(false);
        setSelectedJob(null);
        setActiveTab('active');
        await fetchJobs(courier!.id, 'active', true);
        setTimeout(() => {
          const params = new URLSearchParams(window.location.search);
          params.set('tab', 'active');
          window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        }, 100);
        return;
      }

      const { data: currentJob, error: checkError } = await supabase
        .from('jobs')
        .select('status, assigned_courier_id')
        .eq('id', selectedJob.id)
        .single();

      if (checkError) throw checkError;

      if (currentJob.status === 'assigned' || currentJob.assigned_courier_id) {
        if (currentJob.assigned_courier_id === courier!.id) {
          addNotification('You already accepted this job!', 'info');
          setShowAcceptJobModal(false);
          setActiveTab('active');
          await fetchJobs(courier!.id, 'active', true);
        } else {
          addNotification('Job already accepted by another courier.', 'warning');
          setShowAcceptJobModal(false);
          fetchJobs(courier!.id, 'available', true);
        }
        return;
      }

      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          status: 'assigned',
          assigned_courier_id: courier.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedJob.id);

      if (jobError) throw jobError;

      addNotification('Job accepted successfully!', 'success');
      setShowAcceptJobModal(false);
      setSelectedJob(null);

      setActiveTab('active');
      await fetchJobs(courier!.id, 'active', true);

      setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        params.set('tab', 'active');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      }, 100);
    } catch (error: unknown) {
      console.error('Job acceptance error:', error);
      if (error instanceof Error) {
        addNotification(`Failed to accept job: ${error.message}`, 'warning');
      } else {
        addNotification('Failed to accept job. Please try again.', 'warning');
      }
    } finally {
      setAcceptingJob(false);
    }
  };

  const handleAcceptBackhaulJob = async (jobId: string) => {
    let job = availableJobs.find(j => j.id === jobId);
    if (!job) {
      const { data } = await supabase
        .from('jobs')
        .select('*, cargo_items(*)')
        .eq('id', jobId)
        .maybeSingle();
      if (data) {
        job = data as any;
      }
    }
    if (job) {
      setSelectedJob(job);
      setShowAcceptJobModal(true);
    }
  };

  const submitCounterOffer = async (amount: number, message: string) => {
    if (!hasBankInfo) {
      setShowBankModal(true);
      setShowCounterOfferModal(false);
      throw new Error('Bank account required');
    }

    if (!bankVerified) {
      setShowCounterOfferModal(false);
      throw new Error('Bank account must be verified');
    }

    if (!courier?.id || !user?.id || !selectedJob) {
      throw new Error('Courier information not found');
    }

    try {
      const { error: offerError } = await supabase
        .from('counter_offers')
        .insert({
          job_id: selectedJob.id,
          courier_id: courier.id,
          user_id: user.id,
          amount_ttd: amount,
          message: message || null,
          status: 'pending',
        });

      if (offerError) throw offerError;

      addNotification('Counter offer submitted successfully!', 'success');
      setShowCounterOfferModal(false);
      setSelectedJob(null);
      fetchJobs();
    } catch (error: unknown) {
      console.error('Counter offer submission error:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      } else {
        throw new Error('Failed to submit counter offer');
      }
    }
  };

  const handleSelectStop = async (jobId: string, stopId: string) => {
    const now = new Date().toISOString();

    // OPTIMISTIC UPDATE - Update local state immediately
    setActiveJobs(prevJobs => prevJobs.map(job =>
      job.id === jobId ? { ...job, current_selected_stop_id: stopId, updated_at: now } : job
    ));

    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          current_selected_stop_id: stopId,
          updated_at: now
        })
        .eq('id', jobId);

      if (error) throw error;

      addNotification('Next destination set successfully!', 'success');
      setShowStopSelector(false);
      setSelectingStopForJob(null);

      if (courier?.id) {
        fetchJobs(courier.id, 'active', true);
      }
    } catch (error) {
      console.error('Error selecting stop:', error);
      addNotification('Failed to set destination. Please try again.', 'warning');

      if (courier?.id) {
        await fetchJobs(courier.id, 'active', true);
      }
    }
  };

  const updateStopStatus = async (
    jobId: string,
    stopId: string,
    newStatus: 'NOT_STARTED' | 'ENROUTE' | 'ARRIVED' | 'COMPLETED',
    stopType: 'PICKUP' | 'DROPOFF',
    geofenceData?: {
      lat: number;
      lng: number;
      offline: boolean;
      badPinOverride: boolean;
      badPinPhotoFile?: File;
    }
  ) => {
    console.log('🔄 updateStopStatus called:', { jobId, stopId, newStatus, stopType, geofenceData });

    if (newStatus === 'ENROUTE' && stopType === 'DROPOFF') {
      const job = activeJobs.find(j => j.id === jobId);
      if (job && (job as any).cash_to_return) {
        const cs = (job as any).cash_collection_status;
        if (cs !== 'collected' && cs !== 'returned') {
          addNotification('Collect cash and get recipient signature before continuing to delivery.', 'warning');
          return;
        }
      }
    }

    const now = new Date().toISOString();

    // OPTIMISTIC UPDATE - Update local state immediately for instant UI feedback
    setActiveJobs(prevJobs => {
      const updated = prevJobs.map(job => {
        if (job.id !== jobId) return job;

        let optimisticJobStatus = job.status;
        if (newStatus === 'ARRIVED' && stopType === 'PICKUP' && ['on_way_to_pickup', 'assigned'].includes(job.status)) {
          optimisticJobStatus = 'arrived_waiting' as any;
        }

        return {
          ...job,
          status: optimisticJobStatus,
          delivery_stops: job.delivery_stops?.map(stop => {
            if (stop.id !== stopId) return stop;

            return {
              ...stop,
              status: newStatus,
              updated_at: now,
              ...(newStatus === 'ARRIVED' && { arrived_at: now }),
              ...(newStatus === 'COMPLETED' && { completed_at: now })
            };
          })
        };
      });
      console.log('✅ Optimistic update applied, active jobs count:', updated.length);
      return updated;
    });

    try {
      const updateData: any = {
        status: newStatus,
        updated_at: now
      };

      if (newStatus === 'ARRIVED') {
        updateData.arrived_at = now;
        if (geofenceData) {
          if (geofenceData.lat !== 0 || geofenceData.lng !== 0) {
            updateData.arrived_lat = geofenceData.lat;
            updateData.arrived_lng = geofenceData.lng;
          }
          updateData.bad_pin_override = geofenceData.badPinOverride;
          updateData.offline_arrival = geofenceData.offline;
          if (geofenceData.offline) {
            updateData.offline_arrival_synced_at = now;
          }
        }
      } else if (newStatus === 'COMPLETED') {
        updateData.completed_at = now;
      }

      if (geofenceData?.badPinOverride && geofenceData.badPinPhotoFile) {
        try {
          const fileName = `bad-pin/${jobId}/${stopId}_${Date.now()}.jpg`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('delivery-proofs')
            .upload(fileName, geofenceData.badPinPhotoFile, {
              contentType: geofenceData.badPinPhotoFile.type,
              upsert: true,
            });
          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage
              .from('delivery-proofs')
              .getPublicUrl(uploadData.path);
            updateData.bad_pin_photo_url = urlData.publicUrl;
          }
        } catch (uploadErr) {
          console.error('Bad pin photo upload failed:', uploadErr);
        }
      }

      console.log('💾 Updating delivery_stops in database:', { stopId, updateData });
      const { error } = await supabase
        .from('delivery_stops')
        .update(updateData)
        .eq('id', stopId);

      if (error) {
        console.error('❌ Database update failed:', error);
        throw error;
      }
      console.log('✅ Database update successful');

      // Auto-advance job-level status based on stop milestones
      const currentJob = activeJobs.find(j => j.id === jobId);
      if (currentJob) {
        const allStops = currentJob.delivery_stops || [];
        const pickupStopsLocal = allStops.filter(s => s.stop_type === 'PICKUP');
        const dropoffStopsLocal = allStops.filter(s => s.stop_type === 'DROPOFF');

        const pickupStopsAfterUpdate = pickupStopsLocal.map(s =>
          s.id === stopId ? { ...s, status: newStatus } : s
        );
        const dropoffStopsAfterUpdate = dropoffStopsLocal.map(s =>
          s.id === stopId ? { ...s, status: newStatus } : s
        );

        const allPickupsCompleted = pickupStopsAfterUpdate.every(s => s.status === 'COMPLETED');
        const allDropoffsCompleted = dropoffStopsAfterUpdate.every(s => s.status === 'COMPLETED');
        const anyDropoffEnroute = dropoffStopsAfterUpdate.some(s => s.status === 'ENROUTE' || s.status === 'ARRIVED' || s.status === 'COMPLETED');

        let newJobStatus: string | null = null;

        if (newStatus === 'ARRIVED' && stopType === 'PICKUP' && ['on_way_to_pickup', 'assigned'].includes(currentJob.status)) {
          newJobStatus = 'arrived_waiting';
        } else if (newStatus === 'COMPLETED' && stopType === 'PICKUP' && allPickupsCompleted && ['on_way_to_pickup', 'arrived_waiting', 'loading_cargo'].includes(currentJob.status)) {
          newJobStatus = 'cargo_collected';
        } else if (stopType === 'DROPOFF' && (newStatus === 'ENROUTE' || newStatus === 'ARRIVED') && allPickupsCompleted && anyDropoffEnroute && ['cargo_collected', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo'].includes(currentJob.status)) {
          newJobStatus = 'in_transit';
          const jobUpdate: any = {
            status: 'in_transit',
            tracking_enabled: true,
            updated_at: now
          };
          if (navigator.geolocation) {
            try {
              const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
              });
              jobUpdate.courier_location_lat = position.coords.latitude;
              jobUpdate.courier_location_lng = position.coords.longitude;
              jobUpdate.location_updated_at = now;
            } catch (_) {}
          }
          await supabase.from('jobs').update(jobUpdate).eq('id', jobId);
        } else if (newStatus === 'COMPLETED' && stopType === 'DROPOFF' && allDropoffsCompleted && currentJob.status === 'in_transit') {
          newJobStatus = 'delivered';
        }

        if (newJobStatus && newJobStatus !== 'in_transit') {
          await supabase
            .from('jobs')
            .update({ status: newJobStatus, updated_at: now, ...(newJobStatus === 'delivered' ? { tracking_enabled: false } : {}) })
            .eq('id', jobId);
        }

        if (newJobStatus) {
          setActiveJobs(prevJobs => prevJobs.map(j =>
            j.id === jobId ? { ...j, status: newJobStatus as any } : j
          ));
        }
      }

      // If this was a flexible dropoff that just got completed, clear the selection
      if (newStatus === 'COMPLETED' && stopType === 'DROPOFF') {
        const job = activeJobs.find(j => j.id === jobId);
        if (job?.route_type === 'FLEXIBLE' && job.current_selected_stop_id === stopId) {
          // Optimistic update for job selection
          setActiveJobs(prevJobs => prevJobs.map(j =>
            j.id === jobId ? { ...j, current_selected_stop_id: null } : j
          ));

          await supabase
            .from('jobs')
            .update({
              current_selected_stop_id: null,
              updated_at: now
            })
            .eq('id', jobId);
        }
      }

      if (newStatus === 'ARRIVED' && stopType === 'PICKUP') {
        const job = activeJobs.find(j => j.id === jobId);
        const vehicleType = courier?.vehicle_type || 'car';
        const jobBasePrice = (job as any)?.base_price || (job as any)?.customer_offer_ttd || 0;

        const recordId = await createDetentionRecord(
          jobId, stopId, now, vehicleType, jobBasePrice
        );

        if (recordId) {
          setDetentionRecords(prev => ({
            ...prev,
            [stopId]: {
              recordId,
              arrivedAt: now,
              vehicleType,
              jobBasePrice,
            },
          }));
        }
      }

      if (newStatus === 'COMPLETED' && stopType === 'PICKUP') {
        const detention = detentionRecords[stopId];
        if (detention?.recordId && detention.arrivedAt) {
          const waitMinutes = getMinutesSinceArrival(detention.arrivedAt);
          const fee = await finalizeDetention(
            detention.recordId,
            jobId,
            waitMinutes,
            detention.vehicleType,
            detention.jobBasePrice
          );
          if (fee > 0) {
            addNotification(`Detention fee of $${fee.toFixed(0)} TTD earned for ${waitMinutes} min wait.`, 'success');
          }
          setDetentionRecords(prev => {
            const updated = { ...prev };
            delete updated[stopId];
            return updated;
          });
        }
      }

      const actionText =
        newStatus === 'ENROUTE' ? 'En route' :
        newStatus === 'ARRIVED' ? 'Arrived' :
        newStatus === 'COMPLETED' ? (stopType === 'PICKUP' ? 'Collected' : 'Delivered') :
        'Updated';

      addNotification(`${actionText} successfully!`, 'success');

      if (newStatus === 'ARRIVED' && stopType === 'DROPOFF') {
        const job = activeJobs.find(j => j.id === jobId);
        if (job && (job as any).cash_to_return) {
          const stop = job.delivery_stops?.find(s => s.id === stopId);
          const podStop = (job as any).pod_stops?.find((p: any) => p.stop_id === stopId);
          setCashDeliveryData({
            jobId,
            stopId,
            stopAddress: stop?.location_text || '',
            cashAmount: (job as any).cash_to_return_amount || 0,
            podRequired: (job as any).proof_of_delivery_required || 'SIGNATURE',
            podStopId: podStop?.id
          });
          setShowCashDeliveryModal(true);
        }
      }

      console.log('🔄 Refreshing jobs after stop status update...');
      if (courier?.id) {
        await fetchJobs(courier.id, 'active', true);
        console.log('✅ Jobs refreshed');
      }
    } catch (error) {
      console.error('❌ Error updating stop status:', error);
      addNotification('Failed to update status. Please try again.', 'warning');

      console.log('🔄 Reverting optimistic update by refreshing...');
      if (courier?.id) {
        await fetchJobs(courier.id, 'active', true);
      }
    }
  };

  const handleBeginLoading = async (jobId: string, stopId: string) => {
    setUpdatingStatus(jobId);
    try {
      const now = new Date().toISOString();

      const detention = detentionRecords[stopId];
      if (detention?.recordId && detention.arrivedAt) {
        const waitMinutes = getMinutesSinceArrival(detention.arrivedAt);
        await supabase
          .from('detention_records')
          .update({
            wait_minutes: waitMinutes,
            updated_at: now,
          })
          .eq('id', detention.recordId);
      }

      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'loading_cargo',
          loading_started_at: now,
          updated_at: now,
        })
        .eq('id', jobId);

      if (error) throw error;

      setActiveJobs(prevJobs => prevJobs.map(j =>
        j.id === jobId ? { ...j, status: 'loading_cargo' as any, loading_started_at: now } : j
      ));

      addNotification('Loading started! Waiting timer paused.', 'success');

      if (courier?.id) {
        await fetchJobs(courier.id, 'active', true);
      }
    } catch (error) {
      console.error('Error starting loading:', error);
      addNotification('Failed to update status. Please try again.', 'warning');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleCargoSecured = async (jobId: string, stopId: string) => {
    setUpdatingStatus(jobId);
    try {
      const now = new Date().toISOString();

      const detention = detentionRecords[stopId];
      if (detention?.recordId && detention.arrivedAt) {
        const job = activeJobs.find(j => j.id === jobId);
        const pausedAt = (job as any)?.loading_started_at;
        const endTime = pausedAt ? new Date(pausedAt).getTime() : Date.now();
        const arrivalTime = new Date(detention.arrivedAt).getTime();
        const waitMinutes = Math.floor((endTime - arrivalTime) / 60000);

        await finalizeDetention(
          detention.recordId,
          jobId,
          waitMinutes,
          detention.vehicleType,
          detention.jobBasePrice
        );

        setDetentionRecords(prev => {
          const updated = { ...prev };
          delete updated[stopId];
          return updated;
        });
      }

      await supabase
        .from('delivery_stops')
        .update({ status: 'COMPLETED', completed_at: now, updated_at: now })
        .eq('id', stopId);

      const currentJob = activeJobs.find(j => j.id === jobId);
      if (currentJob) {
        const allStops = currentJob.delivery_stops || [];
        const pickupStops = allStops.filter(s => s.stop_type === 'PICKUP');
        const pickupStopsAfterUpdate = pickupStops.map(s =>
          s.id === stopId ? { ...s, status: 'COMPLETED' } : s
        );
        const allPickupsCompleted = pickupStopsAfterUpdate.every(s => s.status === 'COMPLETED');

        const newJobStatus = allPickupsCompleted ? 'cargo_collected' : 'on_way_to_pickup';

        const jobUpdate: any = {
          status: newJobStatus,
          loading_started_at: null,
          updated_at: now,
        };

        const { error } = await supabase
          .from('jobs')
          .update(jobUpdate)
          .eq('id', jobId);

        if (error) throw error;

        setActiveJobs(prevJobs => prevJobs.map(j =>
          j.id === jobId ? {
            ...j,
            status: newJobStatus as any,
            loading_started_at: null,
            delivery_stops: j.delivery_stops?.map(s =>
              s.id === stopId ? { ...s, status: 'COMPLETED', completed_at: now } : s
            )
          } : j
        ));
      }

      addNotification('Cargo secured! Ready to proceed.', 'success');

      if (courier?.id) {
        await fetchJobs(courier.id, 'active', true);
      }
    } catch (error) {
      console.error('Error securing cargo:', error);
      addNotification('Failed to update status. Please try again.', 'warning');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateJobStatus = async (jobId: string, newStatus: Job['status']) => {
    if (!isMobileDevice()) {
      addNotification('You must use a mobile device to update job status. GPS tracking requires mobile access.', 'warning');
      return;
    }

    setUpdatingStatus(jobId);

    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'in_transit') {
        updateData.tracking_enabled = true;
        if (navigator.geolocation) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            updateData.courier_location_lat = position.coords.latitude;
            updateData.courier_location_lng = position.coords.longitude;
            updateData.location_updated_at = new Date().toISOString();
          } catch (geoError) {
            console.warn('Could not get location:', geoError);
          }
        }
      } else if (newStatus === 'delivered' || newStatus === 'completed') {
        updateData.tracking_enabled = false;
      }

      if (newStatus === 'completed') {
        const job = activeJobs.find(j => j.id === jobId);
        if (!job) {
          throw new Error('Job not found');
        }

        // Check if all delivery stops are completed
        const deliveryStops = job.delivery_stops || [];
        const dropoffStops = deliveryStops.filter(s => s.stop_type === 'DROPOFF');
        const allDropoffsCompleted = dropoffStops.every(s => s.status === 'COMPLETED');

        if (!allDropoffsCompleted) {
          addNotification('All delivery stops must be completed before completing the job.', 'warning');
          setUpdatingStatus(null);
          return;
        }

        if ((job as any).cash_to_return && (job as any).cash_collection_status !== 'returned') {
          if ((job as any).cash_collection_status === 'collected') {
            addNotification('You must return the collected cash before completing this job.', 'warning');
          } else {
            addNotification('Cash collection is required before completing this job.', 'warning');
          }
          setUpdatingStatus(null);
          return;
        }

        // Check cargo items
        const { data: cargoItems } = await supabase
          .from('cargo_items')
          .select('*')
          .eq('job_id', jobId);

        const hasUndeliveredItems = cargoItems?.some(item => item.status === 'pending');
        if (hasUndeliveredItems) {
          addNotification('All cargo items must be delivered before completing the job.', 'warning');
          setUpdatingStatus(null);
          return;
        }

        // CRITICAL: Fetch FRESH POD data from database (don't rely on stale local state)
        const { data: freshPodStops, error: podFetchError } = await supabase
          .from('pod_stops')
          .select('*')
          .eq('job_id', jobId);

        if (podFetchError) {
          console.error('Error fetching POD stops:', podFetchError);
          throw podFetchError;
        }

        console.log('🔍 COMPLETE JOB - POD System Check:', {
          jobId,
          freshPodStopsCount: freshPodStops?.length || 0,
          stopsWithPODRequirements: freshPodStops?.filter(p => p.required_type !== 'NONE').length || 0,
          willUsePodStopsSystem: !!(freshPodStops && freshPodStops.length > 0),
          willUseLegacySystem: !(freshPodStops && freshPodStops.length > 0)
        });

        // Check POD requirements for multi-stop jobs using FRESH data
        if (freshPodStops && freshPodStops.length > 0) {
          console.log('🔍 POD VALIDATION DEBUG - Job:', jobId);

          const incompletePods: Array<{
            stopId: string;
            requiredType: string;
            hasPhoto: boolean;
            hasSignature: boolean;
            photoCount: number;
            missingItems: string[];
          }> = [];

          for (const pod of freshPodStops) {
            if (pod.required_type === 'NONE') continue;

            const requiresPhoto = pod.required_type === 'PHOTO' || pod.required_type === 'PHOTO_AND_SIGNATURE';
            const requiresSignature = pod.required_type === 'SIGNATURE' || pod.required_type === 'PHOTO_AND_SIGNATURE';

            const hasPhoto = pod.photo_urls && pod.photo_urls.length > 0;
            const hasSignature = !!pod.signature_image_url;
            const photoCount = pod.photo_urls?.length || 0;

            const missingItems: string[] = [];
            if (requiresPhoto && !hasPhoto) missingItems.push('photo');
            if (requiresSignature && !hasSignature) missingItems.push('signature');

            console.log(`  Stop ${pod.stop_id}:`, {
              required_type: pod.required_type,
              photoRequired: requiresPhoto,
              photosCount: photoCount,
              hasPhoto,
              signatureRequired: requiresSignature,
              hasSignature,
              status: pod.status,
              missing: missingItems.length > 0 ? missingItems : 'none'
            });

            if (missingItems.length > 0) {
              // Find the stop location for better error message
              const stop = deliveryStops.find(s => s.id === pod.stop_id);
              incompletePods.push({
                stopId: pod.stop_id,
                requiredType: pod.required_type,
                hasPhoto,
                hasSignature,
                photoCount,
                missingItems
              });
            }
          }

          if (incompletePods.length > 0) {
            // Build specific error message
            const firstIncomplete = incompletePods[0];
            const stop = deliveryStops.find(s => s.id === firstIncomplete.stopId);
            const stopLabel = stop ? stop.location_text.substring(0, 30) : 'a stop';
            const missing = firstIncomplete.missingItems.join(' and ');

            console.log('❌ POD INCOMPLETE - blocking completion:', incompletePods);
            addNotification(`${missing.charAt(0).toUpperCase() + missing.slice(1)} required for ${stopLabel}`, 'warning');
            setUpdatingStatus(null);
            return;
          }

          console.log('✅ All POD requirements satisfied');

          // Mark all pod_stops as completed
          for (const podStop of freshPodStops) {
            if (podStop.status !== 'COMPLETED') {
              await supabase
                .from('pod_stops')
                .update({
                  status: 'COMPLETED',
                  completed_at: new Date().toISOString()
                })
                .eq('id', podStop.id);
            }
          }
        }

        // Legacy: Check old proof_of_delivery table ONLY for single-stop jobs
        // Skip this check if job uses pod_stops (multi-stop system)
        if (!freshPodStops || freshPodStops.length === 0) {
          const { data: podData } = await supabase
            .from('proof_of_delivery')
            .select('*')
            .eq('job_id', jobId)
            .maybeSingle();

          if (podData && podData.required_type !== 'NONE') {
            const requiresPhoto = podData.required_type === 'PHOTO' || podData.required_type === 'PHOTO_AND_SIGNATURE';
            const requiresSignature = podData.required_type === 'SIGNATURE' || podData.required_type === 'PHOTO_AND_SIGNATURE';

            const hasPhoto = podData.photo_urls && podData.photo_urls.length > 0;
            const hasSignature = podData.signature_image_url && podData.signed_by_name;

            console.log('🔍 LEGACY POD CHECK:', {
              jobId,
              required_type: podData.required_type,
              requiresPhoto,
              hasPhoto,
              photoCount: podData.photo_urls?.length || 0,
              requiresSignature,
              hasSignature
            });

            if (requiresPhoto && !hasPhoto) {
              console.log('❌ LEGACY POD: Photo missing');
              addNotification('Photo proof of delivery is required before completing this job.', 'warning');
              setUpdatingStatus(null);
              return;
            }

            if (requiresSignature && !hasSignature) {
              console.log('❌ LEGACY POD: Signature missing');
              addNotification('E-signature is required before completing this job.', 'warning');
              setUpdatingStatus(null);
              return;
            }

            console.log('✅ LEGACY POD: All requirements satisfied');

            await supabase
              .from('proof_of_delivery')
              .update({
                status: 'COMPLETED',
                completed_at: new Date().toISOString(),
                completed_by_user_id: user?.id
              })
              .eq('job_id', jobId);
          }
        } else {
          console.log('ℹ️ Skipping legacy POD check - using pod_stops system');
        }

        const { error } = await supabase
          .from('jobs')
          .update(updateData)
          .eq('id', jobId);

        if (error) throw error;

        setActiveJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
        addNotification(isCompanyDriver ? 'Job completed successfully!' : 'Job completed successfully! Payment has been added to your earnings.', 'success');

        // Check if we should prompt to save the dropoff location
        if (dropoffStops.length > 0 && user?.id) {
          // Get the last dropoff (most recent delivery location)
          const lastDropoff = dropoffStops[dropoffStops.length - 1];

          if (lastDropoff.location_lat && lastDropoff.location_lng) {
            // Check if this location is already saved
            const { data: existingLocations } = await supabase
              .from('saved_locations')
              .select('id')
              .eq('user_id', user.id)
              .eq('latitude', lastDropoff.location_lat)
              .eq('longitude', lastDropoff.location_lng);

            // If not already saved, show the modal
            if (!existingLocations || existingLocations.length === 0) {
              setSaveLocationData({
                address: lastDropoff.location_text,
                latitude: lastDropoff.location_lat,
                longitude: lastDropoff.location_lng,
              });
              setShowSaveLocationModal(true);
            }
          }
        }

        // Check for backhaul opportunities near the delivery location
        const completedJob = activeJobs.find(j => j.id === jobId);
        if (completedJob && profile?.home_base_lat && profile?.home_base_lng) {
          let completedDropoff: { lat: number; lng: number; text: string } | null = null;

          if (dropoffStops.length > 0) {
            const lastDropoff = dropoffStops[dropoffStops.length - 1];
            if (lastDropoff.location_lat && lastDropoff.location_lng) {
              completedDropoff = {
                lat: lastDropoff.location_lat,
                lng: lastDropoff.location_lng,
                text: lastDropoff.location_text
              };
            }
          } else if (completedJob.dropoff_lat && completedJob.dropoff_lng) {
            completedDropoff = {
              lat: completedJob.dropoff_lat,
              lng: completedJob.dropoff_lng,
              text: completedJob.dropoff_location_text || ''
            };
          }

          if (completedDropoff) {
            const { data: nearbyJobs } = await supabase
              .from('jobs')
              .select('id, pickup_location_text, pickup_lat, pickup_lng, dropoff_location_text, dropoff_lat, dropoff_lng, total_price, customer_offer_ttd, status, cargo_size_category, distance_km')
              .in('status', ['open', 'bidding'])
              .is('assigned_courier_id', null);

            if (nearbyJobs && nearbyJobs.length > 0) {
              const jobsForMatching = nearbyJobs;

              const homeBase = {
                lat: profile.home_base_lat,
                lng: profile.home_base_lng,
                text: profile.home_base_location_text || 'Home'
              };

              const matches = findBackhaulMatches(
                completedDropoff,
                homeBase,
                jobsForMatching as any[],
                15,
                25
              );

              if (matches.length > 0) {
                setBackhaulModalMatch(matches[0]);
              }
            }
          }
        }

        if (courier?.id) {
          fetchJobs(courier.id, 'active', true);
        }
      } else {
        const { data: updatedJob, error } = await supabase
          .from('jobs')
          .update(updateData)
          .eq('id', jobId)
          .select(`
            *,
            customer_profile:profiles!jobs_customer_user_id_fkey(*)
          `)
          .single();

        if (error) throw error;

        setActiveJobs(prevJobs =>
          prevJobs.map(job =>
            job.id === jobId
              ? (updatedJob as JobWithCustomer)
              : job
          )
        );
        addNotification(`Status updated to: ${formatStatus(newStatus)}`, 'success');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      addNotification('Failed to update status. Please try again.', 'warning');
      if (courier?.id) {
        fetchJobs(courier.id, 'active', true);
      }
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleInitiateReturn = async (reason: ReturnReason, notes: string) => {
    if (!isMobileDevice()) {
      addNotification('You must use a mobile device to update deliveries.', 'warning');
      return;
    }
    if (!returnModalJobId) return;
    const job = activeJobs.find(j => j.id === returnModalJobId);
    if (!job) return;

    const originalFare = job.customer_offer_ttd || 0;
    const insuranceFee = Number((job as any).cargo_insurance_fee) || 0;
    const baseTransportCost = originalFare - insuranceFee;
    const returnFee = Math.round(baseTransportCost * 0.5);
    const returnPlatformFee = 0;
    const returnDriverPayout = returnFee;
    const now = new Date().toISOString();

    const pickupStops = (job.delivery_stops || []).filter(s => s.stop_type === 'PICKUP');
    const pickupLocation = pickupStops[0]?.location_text || (job as any).pickup_location_text || '';
    const pickupLat = pickupStops[0]?.location_lat || (job as any).pickup_lat;
    const pickupLng = pickupStops[0]?.location_lng || (job as any).pickup_lng;

    const dropoffStops = (job.delivery_stops || []).filter(s => s.stop_type === 'DROPOFF');
    const currentDropoff = dropoffStops[0];

    try {
      const currentTotal = (job as any).customer_total || (job as any).total_price || originalFare;
      const currentDriverNet = (job as any).driver_net_earnings || Math.round(originalFare * 0.9 * 100) / 100;
      const currentEarnings = (job as any).courier_earnings || originalFare;

      const updateData: Record<string, unknown> = {
        status: 'returning',
        return_reason: reason,
        return_notes: notes || null,
        return_fee: returnFee,
        return_platform_fee: returnPlatformFee,
        return_driver_payout: returnDriverPayout,
        return_base_transport_cost: baseTransportCost,
        return_initiated_at: now,
        updated_at: now,
        total_price: (job as any).total_price ? Number((job as any).total_price) + returnFee : originalFare + returnFee,
        courier_earnings: currentEarnings + returnFee,
        customer_total: currentTotal + returnFee,
        driver_net_earnings: currentDriverNet + returnDriverPayout,
      };

      if (currentDropoff) {
        updateData.original_dropoff_location_text = currentDropoff.location_text;
        updateData.original_dropoff_lat = currentDropoff.location_lat;
        updateData.original_dropoff_lng = currentDropoff.location_lng;
      }

      updateData.dropoff_location_text = pickupLocation;
      if (pickupLat) updateData.dropoff_lat = pickupLat;
      if (pickupLng) updateData.dropoff_lng = pickupLng;

      const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', returnModalJobId);

      if (error) throw error;

      if (currentDropoff && pickupLocation) {
        await supabase
          .from('delivery_stops')
          .update({
            location_text: pickupLocation,
            location_lat: pickupLat || null,
            location_lng: pickupLng || null,
            status: 'NOT_STARTED',
            arrived_at: null,
            completed_at: null,
            updated_at: now,
          })
          .eq('id', currentDropoff.id);
      }

      addNotification('Return initiated. Please take item back to pickup point.', 'info');
      setShowReturnModal(false);
      setReturnModalJobId(null);

      if (courier?.id) {
        await fetchJobs(courier.id, 'active', true);
      }
    } catch (error) {
      console.error('Error initiating return:', error);
      addNotification('Failed to initiate return. Please try again.', 'warning');
    }
  };

  const formatStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      'assigned': 'Assigned',
      'on_way_to_pickup': 'On Way to Pickup',
      'arrived_waiting': 'Arrived - Waiting',
      'loading_cargo': 'Loading Cargo',
      'cargo_collected': 'Cargo Collected',
      'in_transit': 'In Transit',
      'delivered': 'Delivered',
      'returning': 'Returning',
      'completed': 'Completed',
    };
    return statusMap[status] || status;
  };

  const getNextStatus = (currentStatus: Job['status']): Job['status'] | null => {
    const statusFlow: Record<string, Job['status']> = {
      'assigned': 'on_way_to_pickup',
      'on_way_to_pickup': 'cargo_collected',
      'cargo_collected': 'in_transit',
      'in_transit': 'delivered',
      'delivered': 'completed',
    };
    return statusFlow[currentStatus] || null;
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      'assigned': 'bg-blue-100 text-blue-700',
      'on_way_to_pickup': 'bg-yellow-100 text-yellow-700',
      'arrived_waiting': 'bg-amber-100 text-amber-700',
      'loading_cargo': 'bg-teal-100 text-teal-700',
      'cargo_collected': 'bg-orange-100 text-orange-700',
      'in_transit': 'bg-sky-100 text-sky-700',
      'delivered': 'bg-green-100 text-green-700',
      'returning': 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getFilteredAndSortedJobs = (): JobWithBidInfo[] => {
    let filtered = [...availableJobs];

    switch (activeFilter) {
      case 'near_me':
        if (courierLocation) {
          filtered = filtered
            .map(job => ({
              ...job,
              distanceFromCourier: calculateDistance(
                courierLocation.lat,
                courierLocation.lng,
                job.pickup_lat,
                job.pickup_lng
              )
            }))
            .sort((a, b) => (a.distanceFromCourier || 0) - (b.distanceFromCourier || 0));
        }
        break;

      case 'highest_price':
        filtered = filtered.sort((a, b) => b.customer_offer_ttd - a.customer_offer_ttd);
        break;

      case 'bids_only':
        filtered = filtered.filter(job => job.pricing_type === 'bid');
        break;

      case 'big_cargo':
        filtered = filtered.filter(job =>
          job.cargo_size_category === 'large' || job.cargo_size_category === 'extra_large'
        );
        break;

      case 'courier':
      case 'marketplace_safebuy':
      case 'junk_removal':
      case 'standard':
        filtered = filtered.filter(job => (job as any).job_type === activeFilter);
        break;

      case 'all':
      default:
        break;
    }

    return filtered;
  };

  const getStageInfo = (status: Job['status']): { title: string; description: string; icon: typeof Navigation } => {
    const stageInfoMap: Record<string, { title: string; description: string; icon: typeof Navigation }> = {
      'assigned': {
        title: 'Step 1: Job Assigned',
        description: 'Review the pickup and dropoff locations below. When you\'re ready to drive to the pickup location, tap "Start Pickup".',
        icon: CheckCircle2,
      },
      'on_way_to_pickup': {
        title: 'Step 2: Heading to Pickup',
        description: 'You\'re on your way to collect the cargo. Once you arrive at the pickup location and have the cargo loaded, tap "Confirm Pickup".',
        icon: Navigation,
      },
      'cargo_collected': {
        title: 'Step 3: Cargo Loaded',
        description: 'Cargo is now loaded in your vehicle. When you start driving to the delivery location, tap "Start Delivery".',
        icon: Package,
      },
      'in_transit': {
        title: 'Step 4: Delivering',
        description: 'You\'re on your way to the delivery location. Once you arrive and the customer receives the cargo, tap "Mark Delivered".',
        icon: Truck,
      },
      'delivered': {
        title: 'Step 5: Complete Job',
        description: 'Cargo successfully delivered! You can upload proof of delivery (optional) and tap the button below to complete this job.',
        icon: Camera,
      },
      'returning': {
        title: 'Returning to Base',
        description: 'Delivery was unsuccessful. Please return the item to the original pickup location.',
        icon: Navigation,
      },
    };
    return stageInfoMap[status] || {
      title: 'Unknown Status',
      description: '',
      icon: Info,
    };
  };

  const renderJobCard = (job: JobWithBidInfo, showBidStatus: boolean = false) => {
    const isAsap = job.delivery_type === 'asap' || (job.urgency_hours !== null && job.urgency_hours === 0);
    const isExpanded = expandedJob === job.id;

    const route = buildRouteFromJob(job);
    const isMultiRoute = route.isMultiStop || route.pickups.length > 1 || route.dropoffs.length > 1;
    const hasMultiplePickups = route.pickups.length > 1;
    const hasMultipleDropoffs = route.dropoffs.length > 1;

    return (
      <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const jt = getJobTypeInfo((job as any).job_type);
                const IconMap = { Package, Bike, ShoppingBag, Trash2, ShoppingCart };
                const Icon = IconMap[jt.iconName];
                return (job as any).job_type && (job as any).job_type !== 'standard' ? (
                  <div className={`flex items-center gap-1 ${jt.badgeBg} ${jt.badgeText} px-2 py-1 rounded-full border ${jt.badgeBorder}`}>
                    <Icon className="w-3 h-3" />
                    <span className="text-xs font-bold">{jt.shortLabel}</span>
                  </div>
                ) : null;
              })()}
              {job.customer_profile?.business_type === 'retail' && (
                <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-full border border-amber-300">
                  <Building2 className="w-3 h-3" />
                  <span className="text-xs font-bold">Retail Business</span>
                </div>
              )}
              {isAsap && (
                <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full">
                  <Zap className="w-3 h-3" />
                  <span className="text-xs font-bold">ASAP</span>
                </div>
              )}
              {!isAsap && job.delivery_type === 'scheduled' && (
                <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  <Calendar className="w-3 h-3" />
                  <span className="text-xs font-medium">Scheduled</span>
                </div>
              )}
              {job.pricing_type === 'bid' && (
                <div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  <Scale className="w-3 h-3" />
                  <span className="text-xs font-medium">Open to Bids</span>
                </div>
              )}
              {hasMultiplePickups && (
                <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  <MapPin className="w-3 h-3" />
                  <span className="text-xs font-medium">Multi-Pickup</span>
                </div>
              )}
              {hasMultipleDropoffs && (
                <div className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                  <Navigation className="w-3 h-3" />
                  <span className="text-xs font-medium">Multi-Dropoff</span>
                </div>
              )}
              {isMultiRoute && (
                <div className="text-xs font-medium text-gray-700 px-2 py-1 bg-gray-100 rounded-full">
                  Pickups: {route.pickups.length} • Dropoffs: {route.dropoffs.length}
                </div>
              )}
              {(job as any).cash_to_return && !isCompanyDriver && (
                <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-full border border-amber-300">
                  <Banknote className="w-3 h-3" />
                  <span className="text-xs font-bold">Cash ${((job as any).cash_to_return_amount || 0).toLocaleString()}</span>
                </div>
              )}
              {(job as any).is_high_value && (
                <div className="flex items-center gap-1 bg-sky-100 text-sky-800 px-2 py-1 rounded-full border border-sky-300">
                  <Gem className="w-3 h-3" />
                  <span className="text-xs font-bold">High Value</span>
                </div>
              )}
              {(job as any).cargo_insurance_enabled && !(job as any).is_high_value && (
                <div className="flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full border border-emerald-300">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="text-xs font-bold">Insured</span>
                </div>
              )}
            </div>
            {showBidStatus && job.totalBids && job.totalBids > 0 && (
              <div className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" />
                <span className="text-xs font-bold">{job.totalBids} {job.totalBids === 1 ? 'Bid' : 'Bids'}</span>
              </div>
            )}
          </div>

          <div className="space-y-3 mb-4">
            {(() => {
              if (route.pickupGroups.length > 0 && hasMultiplePickups) {
                return (
                  <div className="space-y-2">
                    {route.pickupGroups.map((group, idx) => (
                      <div key={idx} className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-blue-600 font-bold">Pickup {idx + 1}</p>
                            <p className="text-sm text-gray-900">{group.pickup.address}</p>
                          </div>
                        </div>
                        {group.dropoffs.length > 0 && (
                          <div className="ml-6 mt-1">
                            <p className="text-xs text-gray-600 font-medium">
                              → {group.dropoffs.length} dropoff{group.dropoffs.length > 1 ? 's' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }

              if (hasMultiplePickups) {
                return (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-600 font-medium">Pickups ({route.pickups.length})</p>
                        <div className="space-y-1">
                          {route.pickups.map((pickup, idx) => (
                            <p key={pickup.id} className="text-sm text-gray-900">
                              <span className="font-semibold">P{idx + 1}:</span> {pickup.address}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 font-medium">Pickup</p>
                    <p className="text-sm text-gray-900">{route.pickups[0]?.address || job.pickup_location_text}</p>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 font-medium">
                  {hasMultipleDropoffs ? `Dropoffs (${route.dropoffs.length})` : 'Dropoff'}
                </p>
                <div className="space-y-1">
                  {route.dropoffs.map((dropoff, idx) => (
                    <p key={dropoff.id} className="text-sm text-gray-900">
                      {hasMultipleDropoffs && <span className="font-semibold">Stop {idx + 1}:</span>} {dropoff.address}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-gray-600 pt-2">
              <div className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                <span className="capitalize">{job.cargo_size_category}</span>
                {job.cargo_size_category === 'large' && job.cargo_items && job.cargo_items.length > 0 && (
                  <>
                    {job.cargo_items.some((item: any) => item.dimensions_length && item.dimensions_width && item.dimensions_height) ? (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">+Dims</span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">No dims</span>
                    )}
                  </>
                )}
              </div>
              {!isAsap && job.urgency_hours && job.urgency_hours > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Within {job.urgency_hours}h</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span>{job.distance_km} km</span>
              </div>
              {job.cargo_weight_kg && (
                <div className="flex items-center gap-1">
                  <span>{Number(job.cargo_weight_kg) % 1 === 0 ? Math.round(job.cargo_weight_kg) : Number(job.cargo_weight_kg).toFixed(1)} kg</span>
                </div>
              )}
            </div>

            {(job.cargo_category || job.cargo_notes || job.is_fragile || job.needs_cover || job.requires_heavy_lift || job.has_security_gate || isMultiRoute || (job.cargo_items && job.cargo_items.length > 0)) && (
              <button
                onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {isExpanded ? 'Hide Details' : 'Show More Details'}
              </button>
            )}

            {isExpanded && (
              <div className="space-y-2">
                {isMultiRoute && (
                  <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Navigation className="w-4 h-4 text-blue-600" />
                      <p className="text-sm font-semibold text-gray-900">Complete Route</p>
                    </div>
                    <div className="space-y-3">
                      {route.pickupGroups.length > 0 && hasMultiplePickups ? (
                        route.pickupGroups.map((group, groupIdx) => (
                          <div key={groupIdx} className="space-y-2">
                            <div className="bg-white p-3 rounded-lg border-2 border-blue-300">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                  P{groupIdx + 1}
                                </span>
                                <div className="flex-1">
                                  <p className="text-xs font-bold text-blue-700">Pickup {groupIdx + 1}</p>
                                  <p className="text-sm text-gray-900 font-medium">{group.pickup.address}</p>
                                </div>
                              </div>
                              {group.dropoffs.length > 0 && (
                                <div className="ml-8 mt-2 space-y-2">
                                  <p className="text-xs font-bold text-gray-700 mb-1">Drop-off Stops for P{groupIdx + 1}:</p>
                                  {group.dropoffs.map((dropoff, dropIdx) => {
                                    const globalStopIndex = route.dropoffs.findIndex(d => d.id === dropoff.id) + 1;
                                    const cargoForStop = job.cargo_items?.filter(
                                      item => item.dropoff_location_text === dropoff.address
                                    ) || [];

                                    return (
                                      <div key={dropoff.id} className="bg-red-50 p-2 rounded border border-red-200">
                                        <div className="flex items-start gap-2">
                                          <span className="bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                            {globalStopIndex}
                                          </span>
                                          <div className="flex-1">
                                            <p className="text-xs text-gray-900 font-medium">{dropoff.address}</p>
                                            {cargoForStop.length > 0 && (
                                              <p className="text-xs text-gray-600 mt-1">
                                                Cargo: {cargoForStop.length} item{cargoForStop.length > 1 ? 's' : ''}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="space-y-3">
                          {route.pickups.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-700 mb-2">
                                {route.pickups.length > 1 ? 'Pickups:' : 'Pickup:'}
                              </p>
                              <div className="space-y-2">
                                {route.pickups.map((pickup, idx) => (
                                  <div key={pickup.id} className="bg-white p-2 rounded border border-blue-200 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                        P{idx + 1}
                                      </span>
                                      <span className="text-gray-900 font-medium">{pickup.address}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {route.dropoffs.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-700 mb-2">
                                {route.dropoffs.length > 1 ? 'Dropoffs:' : 'Dropoff:'}
                              </p>
                              <div className="space-y-2">
                                {route.dropoffs.map((dropoff, idx) => {
                                  const cargoForStop = job.cargo_items?.filter(
                                    item => item.dropoff_location_text === dropoff.address
                                  ) || [];

                                  return (
                                    <div key={dropoff.id} className="bg-white p-2 rounded border border-red-200 text-xs">
                                      <div className="flex items-start gap-2">
                                        <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                          {idx + 1}
                                        </span>
                                        <div className="flex-1">
                                          <p className="text-gray-900 font-medium">{dropoff.address}</p>
                                          {cargoForStop.length > 0 && (
                                            <p className="text-gray-600 mt-1">
                                              Cargo: {cargoForStop.length} item{cargoForStop.length > 1 ? 's' : ''}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {job.cargo_items && job.cargo_items.length > 0 && (
                  <div className="p-3 bg-orange-50 border-2 border-orange-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-orange-600" />
                        <p className="text-sm font-semibold text-gray-900">Cargo Items ({job.cargo_items.length})</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                          {job.cargo_items.filter(item => item.status === 'delivered').length} Delivered
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
                          {job.cargo_items.filter(item => item.status === 'pending').length} Pending
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {job.cargo_items.map((item, idx) => {
                        const isDelivered = item.status === 'delivered';
                        const canMarkDelivered = activeTab === 'active' && ['cargo_collected', 'in_transit', 'delivered'].includes(job.status) && !isDelivered;

                        return (
                          <div
                            key={item.id}
                            className={`bg-white p-3 rounded-lg border-2 transition-all ${
                              isDelivered
                                ? 'border-green-300 bg-green-50'
                                : 'border-orange-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Package className={`w-4 h-4 ${isDelivered ? 'text-green-700' : 'text-gray-700'}`} />
                                <p className={`text-sm font-bold ${isDelivered ? 'text-green-900' : 'text-gray-900'}`}>
                                  Item {idx + 1}
                                </p>
                              </div>
                              {isDelivered ? (
                                <span className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-full text-xs font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Delivered
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="flex flex-wrap gap-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium capitalize">
                                  {item.cargo_size_category}
                                </span>
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium capitalize">
                                  {item.cargo_category === 'other' ? item.cargo_category_custom : item.cargo_category}
                                </span>
                                {item.cargo_weight_kg && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">
                                    {Number(item.cargo_weight_kg) % 1 === 0 ? Math.round(item.cargo_weight_kg) : Number(item.cargo_weight_kg).toFixed(1)} kg
                                  </span>
                                )}
                              </div>
                              {item.cargo_size_category === 'large' && (
                                <div className="mt-1">
                                  {item.dimensions_length && item.dimensions_width && item.dimensions_height ? (
                                    <p className="text-gray-700">
                                      <span className="font-semibold">Dimensions:</span>{' '}
                                      {Number(item.dimensions_length)}{item.dimensions_length_unit || item.dimensions_unit || 'ft'} x {Number(item.dimensions_width)}{item.dimensions_width_unit || item.dimensions_unit || 'in'} x {Number(item.dimensions_height)}{item.dimensions_height_unit || item.dimensions_unit || 'in'}
                                    </p>
                                  ) : (
                                    <p className="text-amber-600">
                                      <span className="font-semibold">Dimensions:</span> Not provided
                                    </p>
                                  )}
                                </div>
                              )}
                              {item.cargo_photo_url && (
                                <div className="mt-2">
                                  <img
                                    src={item.cargo_photo_url}
                                    alt={`Cargo item ${idx + 1}`}
                                    className="w-full h-48 object-cover rounded-lg border border-gray-300"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              {item.cargo_notes && (
                                <p className="text-gray-700 bg-gray-50 p-2 rounded">
                                  <span className="font-semibold">Notes:</span> {item.cargo_notes}
                                </p>
                              )}
                              {item.dropoff_location_text && (
                                <div className="border-t border-orange-200 pt-2 mt-2">
                                  <div className="flex items-start gap-1">
                                    <MapPin className="w-3 h-3 text-red-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-gray-900 font-medium">{item.dropoff_location_text}</p>
                                  </div>
                                  {item.dropoff_contact_name && (
                                    <p className="text-gray-600 ml-4 mt-1">Contact: {item.dropoff_contact_name}</p>
                                  )}
                                  {item.dropoff_contact_phone && (
                                    <p className="text-gray-600 ml-4">Phone: {item.dropoff_contact_phone}</p>
                                  )}
                                </div>
                              )}
                              {canMarkDelivered && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const { error } = await supabase
                                        .from('cargo_items')
                                        .update({
                                          status: 'delivered',
                                          delivered_at: new Date().toISOString()
                                        })
                                        .eq('id', item.id);

                                      if (error) throw error;

                                      addNotification(`Item ${idx + 1} marked as delivered!`, 'success');
                                      if (courier?.id) {
                                        fetchJobs(courier.id, 'active', true);
                                      }
                                    } catch (error) {
                                      console.error('Error marking item as delivered:', error);
                                      addNotification('Failed to mark item as delivered. Please try again.', 'warning');
                                    }
                                  }}
                                  className="w-full mt-2 py-2 px-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2 text-xs"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Mark as Delivered
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {job.cargo_category && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600 font-medium mb-1">Cargo Type</p>
                    <p className="text-sm text-gray-900 capitalize">
                      {job.cargo_category === 'other' ? job.cargo_category_custom : job.cargo_category}
                    </p>
                  </div>
                )}
                {job.cargo_notes && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 font-medium mb-1">Special Instructions</p>
                    <p className="text-sm text-gray-700">{job.cargo_notes}</p>
                  </div>
                )}
                {(job.is_fragile || job.needs_cover || job.requires_heavy_lift || job.has_security_gate) && (
                  <div className="p-3 bg-orange-50 border-2 border-orange-200 rounded-lg">
                    <p className="text-xs text-gray-600 font-medium mb-2">⚠️ Special Requirements</p>
                    <div className="flex flex-wrap gap-2">
                      {job.is_fragile && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          Fragile - Handle with Care
                        </span>
                      )}
                      {job.needs_cover && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          <Shield className="w-3 h-3" />
                          Needs Cover/Protection
                        </span>
                      )}
                      {job.requires_heavy_lift && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          <Dumbbell className="w-3 h-3" />
                          Heavy - Lorry Man Needed
                        </span>
                      )}
                      {job.has_security_gate && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <Lock className="w-3 h-3" />
                          Security Gate Access
                        </span>
                      )}
                    </div>
                    {job.special_requirements_notes && (
                      <p className="text-xs text-gray-700 mt-2 pt-2 border-t border-orange-200">
                        {job.special_requirements_notes}
                      </p>
                    )}
                  </div>
                )}
                {job.scheduled_pickup_time && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600 font-medium mb-1">Scheduled Pickup</p>
                    <p className="text-sm text-gray-900">
                      {new Date(job.scheduled_pickup_time).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isCompanyDriver && (
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-xs text-gray-600 mb-1">Job Value</p>
                <p className="text-2xl font-bold text-green-600">TTD ${job.customer_offer_ttd}</p>
              </div>
            )}
          </div>

          {showBidStatus && job.myBid ? (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="text-sm font-bold text-green-600">Bid Submitted</p>
              </div>
              <div className="space-y-2 text-sm">
                {!isCompanyDriver && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Your Bid:</span>
                    <span className="font-bold text-gray-900">TTD ${job.myBid.amount_ttd}</span>
                  </div>
                )}
                {job.myBid.eta_minutes && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Your ETA:</span>
                    <span className="font-medium text-gray-900">{formatMinutesToHoursMinutes(job.myBid.eta_minutes)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium text-blue-600 capitalize">{job.myBid.status}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Submitted:</span>
                  <span>{new Date(job.myBid.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : showBidStatus && job.myCounterOffer ? (
            <div className="border-t border-gray-200 pt-4">
              {job.hasNewCustomerCounterOffer ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <p className="text-sm font-bold text-orange-600">New Counter Offer Received</p>
                  </div>
                  <button
                    onClick={() => onNavigate(`/job/${job.id}?offerId=${job.latestCustomerCounterOfferId}`)}
                    className="w-full py-3 px-4 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-5 h-5" />
                    View New Counter Offer
                  </button>
                </div>
              ) : job.myCounterOffer.status === 'accepted' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-bold text-green-600">Counter Offer Accepted</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    {!isCompanyDriver && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Accepted Offer:</span>
                        <span className="font-bold text-gray-900">TTD ${job.myCounterOffer.amount_ttd}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : job.myCounterOffer.status === 'rejected' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <p className="text-sm font-bold text-red-600">Counter Offer Declined</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    {!isCompanyDriver && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Your Offer:</span>
                        <span className="font-bold text-gray-900">TTD ${job.myCounterOffer.amount_ttd}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    <p className="text-sm font-bold text-blue-600">Counter Offer Submitted</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    {!isCompanyDriver && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Your Offer:</span>
                        <span className="font-bold text-gray-900">TTD ${job.myCounterOffer.amount_ttd}</span>
                      </div>
                    )}
                    {job.myCounterOffer.message && (
                      <div>
                        <span className="text-gray-600">Message:</span>
                        <p className="text-gray-900 mt-1">{job.myCounterOffer.message}</p>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-blue-600 capitalize">{job.myCounterOffer.status}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Submitted:</span>
                      <span>{new Date(job.myCounterOffer.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : biddingJob === job.id ? (
            <div className="space-y-3 border-t border-gray-200 pt-4">
              {!isCompanyDriver && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Your Bid (TTD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Enter amount"
                    min="0"
                    step="10"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ETA (e.g., "2h 30m" or "45m")
                </label>
                <input
                  type="text"
                  value={bidEta}
                  onChange={(e) => setBidEta(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="e.g., 2h 30m or 45m"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={bidMessage}
                  onChange={(e) => setBidMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  rows={2}
                  placeholder="Optional message..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setBiddingJob(null)}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => submitBid(job.id)}
                  disabled={submitting}
                  className="flex-1 py-2 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Bid
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : job.pricing_type === 'bid' ? (
            <button
              onClick={() => {
                setBiddingJob(job.id);
                setBidAmount(job.customer_offer_ttd?.toString() || '');
              }}
              className="w-full py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 transition-all"
            >
              Place Bid
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedJob(job);
                  setShowAcceptJobModal(true);
                }}
                className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all"
              >
                Accept Job
              </button>
              <button
                onClick={() => {
                  setSelectedJob(job);
                  setShowCounterOfferModal(true);
                }}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
              >
                Counter Offer
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderActiveJobCard = (job: JobWithCustomer) => {
    const wizardState = buildDriverWizardState(job);

    return (
      <div key={job.id} id={`job-card-${job.id}`}>
        <ActiveJobCard
          job={job}
          wizardState={wizardState}
          updatingStatus={updatingStatus}
          courier={courier}
          podSectionRef={podSectionRef}
          podCollectedStops={podCollectedStops}
          onUpdateJobStatus={updateJobStatus}
          onUpdateStopStatus={updateStopStatus}
          onOpenPodGate={(data) => {
            setPodGateData(data);
            setShowPodGateModal(true);
          }}
        onSelectStop={async (jobId, stopId, label) => {
          const now = new Date().toISOString();

          // OPTIMISTIC UPDATE - Update local state immediately
          setActiveJobs(prevJobs => prevJobs.map(j =>
            j.id === jobId ? { ...j, current_selected_stop_id: stopId, updated_at: now } : j
          ));

          const { error } = await supabase
            .from('jobs')
            .update({ current_selected_stop_id: stopId, updated_at: now })
            .eq('id', jobId);

          if (!error) {
            addNotification(`Destination set to ${label}`, 'success');
            // Refresh in background
            if (courier?.id) {
              fetchJobs(courier.id, 'active', true);
            }
          } else {
            // Revert on error
            if (courier?.id) {
              await fetchJobs(courier.id, 'active', true);
            }
          }
        }}
        onClearSelection={async (jobId) => {
          const now = new Date().toISOString();

          // OPTIMISTIC UPDATE - Update local state immediately
          setActiveJobs(prevJobs => prevJobs.map(j =>
            j.id === jobId ? { ...j, current_selected_stop_id: null, updated_at: now } : j
          ));

          const { error } = await supabase
            .from('jobs')
            .update({ current_selected_stop_id: null, updated_at: now })
            .eq('id', jobId);

          if (!error) {
            addNotification('You can now select a different stop', 'info');
            // Refresh in background
            if (courier?.id) {
              fetchJobs(courier.id, 'active', true);
            }
          } else {
            // Revert on error
            if (courier?.id) {
              await fetchJobs(courier.id, 'active', true);
            }
          }
        }}
        onFetchJobs={fetchJobs}
        onNotification={addNotification}
        onShowCompletionModal={(data) => {
          const job = activeJobs.find(j => j.id === data.jobId);
          if (data.stopType === 'DROPOFF' && job && (job as any).cash_to_return) {
            const podStop = (job as any).pod_stops?.find((p: any) => p.stop_id === data.stopId);
            setCashDeliveryData({
              jobId: data.jobId,
              stopId: data.stopId,
              stopAddress: data.stopAddress,
              cashAmount: (job as any).cash_to_return_amount || 0,
              podRequired: data.podRequired,
              podStopId: podStop?.id
            });
            setShowCashDeliveryModal(true);
            return;
          }
          setCompletionModalData(data);
          setShowCompletionModal(true);
        }}
        formatStatus={formatStatus}
        getStatusColor={getStatusColor}
        onOpenChat={(convId) => setChatConversationId(convId)}
        detentionInfo={detentionRecords}
        onReturnItem={(jobId) => {
          setReturnModalJobId(jobId);
          setShowReturnModal(true);
        }}
        isCompanyDriver={isCompanyDriver}
        onBeginLoading={handleBeginLoading}
        onCargoSecured={handleCargoSecured}
      />
      </div>
    );
  };

  const renderActiveJobCard_OLD = (job: JobWithCustomer) => {
    const wizardState = buildDriverWizardState(job);

    return (
      <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* ============================ */}
        {/* DRIVER COCKPIT - ONLY INTERACTIVE SECTION */}
        {/* ============================ */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-b-4 border-blue-500">
          {/* Header: Status Badge + Job Type + Price */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(job.status)}`}>
                  {formatStatus(job.status)}
                </div>
                <div className="px-2 py-1 bg-blue-600 text-white rounded-full text-xs font-bold">
                  {wizardState.jobTypeLabel}
                </div>
                {wizardState.routeType === 'FLEXIBLE' && (
                  <div className="px-2 py-1 bg-orange-600 text-white rounded-full text-xs font-bold">
                    Flexible Order
                  </div>
                )}
              </div>
              {job.scheduled_pickup_time && (
                <div className="flex items-center gap-1 text-xs text-gray-700">
                  <Calendar className="w-3 h-3" />
                  <span className="font-medium">
                    Scheduled: {new Date(job.scheduled_pickup_time).toLocaleString('en-US', {
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
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">TTD ${job.customer_offer_ttd}</p>
              </div>
            )}
          </div>

          {/* Progress Indicator */}
          <div className="mb-4">
            <p className="text-sm font-bold text-gray-800 mb-2">
              Step {wizardState.isFinished ? wizardState.totalTasks : wizardState.completedTasks + 1} of {wizardState.totalTasks} • {wizardState.completedTasks}/{wizardState.totalTasks} completed
            </p>
            <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-blue-600 to-green-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${wizardState.progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* ===== JOB FINISHED STATE ===== */}
          {wizardState.isFinished ? (
            <>
              <div className="mb-4 p-4 bg-green-50 border-2 border-green-500 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-900">All Stops Completed</h3>
                    <p className="text-sm text-green-700">Ready to complete this job</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => updateJobStatus(job.id, 'completed')}
                disabled={updatingStatus === job.id}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingStatus === job.id ? (
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
                COMPLETE JOB
              </button>
            </>
          ) : wizardState.needsStopSelection ? (
            /* ===== FLEXIBLE ROUTE: STOP SELECTION ===== */
            <>
              <div className="mb-4 p-4 bg-white border-2 border-orange-500 rounded-xl">
                <h3 className="text-base font-bold text-orange-900 mb-1">NEXT ACTION</h3>
                <p className="text-lg font-bold text-orange-900 mb-1">Choose Next Delivery Stop</p>
                <p className="text-xs text-orange-700">Flexible order — deliver in any order you prefer</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-800 px-1">Select Destination:</p>
                {wizardState.tasks
                  .filter(t => t.type === 'DROPOFF' && t.status !== 'DELIVERED')
                  .map((task) => (
                    <button
                      key={task.taskId}
                      onClick={async () => {
                        if (task.stopId) {
                          const { error } = await supabase
                            .from('jobs')
                            .update({ current_selected_stop_id: task.stopId })
                            .eq('id', job.id);

                          if (!error && courier?.id) {
                            await fetchJobs(courier.id, 'active', true);
                            addNotification(`Destination set to ${task.displayLabel}`, 'success');
                          }
                        }
                      }}
                      className="w-full p-4 bg-white border-2 border-gray-300 hover:border-orange-500 hover:bg-orange-50 rounded-xl transition-all text-left shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {task.index}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 mb-1">{task.displayLabel}</p>
                          <p className="text-sm text-gray-700 mb-2">{task.address}</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {task.cargoSummary && (
                              <span className="text-xs text-gray-600 flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {task.cargoSummary}
                              </span>
                            )}
                            {task.podRequirement !== 'NONE' && (
                              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium flex items-center gap-1">
                                <Camera className="w-3 h-3" />
                                POD Required
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </>
          ) : wizardState.currentTask ? (
            /* ===== NORMAL FLOW: CURRENT STEP ===== */
            <>
              {/* NEXT ACTION Card */}
              <div className={`mb-4 p-4 bg-white border-2 rounded-xl ${
                wizardState.currentTask.type === 'PICKUP' ? 'border-green-500' : 'border-red-500'
              }`}>
                <h3 className="text-base font-bold text-gray-700 mb-1">NEXT ACTION</h3>
                <p className="text-lg font-bold text-gray-900 mb-2">
                  {wizardState.currentTask.type === 'PICKUP' ? 'Go to ' : 'Deliver '}{wizardState.currentTask.displayLabel}
                </p>
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    wizardState.currentTask.type === 'PICKUP' ? 'text-green-600' : 'text-red-600'
                  }`} />
                  <p className="text-sm text-gray-700">{wizardState.currentTask.address}</p>
                </div>
                {wizardState.currentTask.contactName && (
                  <p className="text-xs text-gray-600 flex items-center gap-1 mt-2">
                    <Phone className="w-3 h-3" />
                    {wizardState.currentTask.contactName}
                    {wizardState.currentTask.contactPhone && ` • ${wizardState.currentTask.contactPhone}`}
                  </p>
                )}
                {wizardState.currentTask.type === 'DROPOFF' && wizardState.currentTask.podRequirement !== 'NONE' && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-900 font-medium flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      POD Required: {wizardState.currentTask.podRequirement.replace(/_/g, ' & ')}
                    </p>
                  </div>
                )}
              </div>

              {/* GET DIRECTIONS Button */}
              {(() => {
                const task = wizardState.currentTask;
                const mapsUrl = task.lat && task.lng
                  ? `https://www.google.com/maps/dir/?api=1&destination=${task.lat},${task.lng}`
                  : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(task.address)}`;

                return (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full mb-4 py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg text-base sm:text-lg"
                  >
                    <Navigation className="w-5 h-5 sm:w-6 sm:h-6" />
                    GET DIRECTIONS
                  </a>
                );
              })()}

              {/* POD SECTION (IF REQUIRED FOR CURRENT DROPOFF) */}
              {wizardState.currentTask.type === 'DROPOFF' && wizardState.currentTask.podRequirement !== 'NONE' && wizardState.currentTask.stopId && (
                <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="w-5 h-5 text-amber-700" />
                    <p className="text-sm font-bold text-amber-900">Proof of Delivery Required</p>
                  </div>
                  <div ref={podSectionRef}>
                    <DriverCockpitPOD
                      jobId={job.id}
                      stopId={wizardState.currentTask.stopId}
                      podStop={job.pod_stops?.find(pod => pod.stop_id === wizardState.currentTask.stopId) || null}
                      podRequired={job.proof_of_delivery_required || 'NONE'}
                      onUpdate={async () => {
                        if (courier?.id) {
                          await fetchJobs(courier.id, 'active', true);
                        }
                      }}
                      onNotification={addNotification}
                    />
                  </div>
                </div>
              )}

              {/* STATUS BUTTONS - ONLY CONTROLS FOR UPDATING PROGRESS */}
              <div className="p-4 bg-white rounded-xl border-2 border-gray-300">
                <p className="text-sm font-bold text-gray-800 mb-3">Update Status:</p>
                <div className="flex gap-2">
                  {(() => {
                    const task = wizardState.currentTask!;
                    const actions = ['ENROUTE', 'ARRIVED', task.type === 'PICKUP' ? 'COLLECTED' : 'DELIVERED'];

                    return actions.map((action) => {
                      const isActive =
                        (action === 'ENROUTE' && task.status === 'ENROUTE') ||
                        (action === 'ARRIVED' && task.status === 'ARRIVED') ||
                        ((action === 'COLLECTED' || action === 'DELIVERED') && (task.status === 'COLLECTED' || task.status === 'DELIVERED'));

                      let isDisabled = false;
                      const isCashJob = (job as any).cash_to_return;
                      const cashStatus = (job as any).cash_collection_status;
                      const cashPending = isCashJob && cashStatus !== 'collected' && cashStatus !== 'returned';

                      if (action === 'ENROUTE' && task.type === 'DROPOFF' && cashPending) {
                        isDisabled = true;
                      }
                      if (action === 'COLLECTED' || action === 'DELIVERED') {
                        if (task.status !== 'ARRIVED' && task.status !== 'COLLECTED' && task.status !== 'DELIVERED') {
                          isDisabled = true;
                        }
                        if (action === 'DELIVERED' && task.type === 'DROPOFF' && task.podRequirement !== 'NONE') {
                          const podStop = job.pod_stops?.find(pod => pod.stop_id === task.stopId);
                          const needsPhoto = task.podRequirement === 'PHOTO' || task.podRequirement === 'PHOTO_AND_SIGNATURE';
                          const needsSignature = task.podRequirement === 'SIGNATURE' || task.podRequirement === 'PHOTO_AND_SIGNATURE';
                          const hasPhoto = podStop && podStop.photo_urls && podStop.photo_urls.length > 0;
                          const hasSignature = podStop && podStop.signature_image_url;

                          if ((needsPhoto && !hasPhoto) || (needsSignature && !hasSignature)) {
                            isDisabled = true;
                          }
                        }
                      }

                      const label =
                        action === 'ENROUTE' ? 'En Route' :
                        action === 'ARRIVED' ? 'Arrived' :
                        action === 'COLLECTED' ? 'Collected' :
                        'Delivered';

                      const newStatus =
                        action === 'ENROUTE' ? 'ENROUTE' :
                        action === 'ARRIVED' ? 'ARRIVED' :
                        'COMPLETED';

                      return (
                        <button
                          key={action}
                          onClick={() => {
                            if (!isActive && task.stopId) {
                              if (action === 'COLLECTED' || action === 'DELIVERED') {
                                setCompletionModalData({
                                  jobId: job.id,
                                  stopId: task.stopId,
                                  stopAddress: task.address,
                                  stopType: task.type,
                                  podStop: job.pod_stops?.find(pod => pod.stop_id === task.stopId) || null,
                                  podRequired: job.proof_of_delivery_required || 'NONE'
                                });
                                setShowCompletionModal(true);
                              } else {
                                updateStopStatus(job.id, task.stopId, newStatus, task.type);
                              }
                            }
                          }}
                          disabled={isDisabled}
                          className={`flex-1 py-3 px-2 rounded-lg font-bold text-sm transition-all ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-md'
                              : isDisabled
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    });
                  })()}
                </div>

                {(() => {
                  const task = wizardState.currentTask!;
                  const isCashJob = (job as any).cash_to_return;
                  const cashStatus = (job as any).cash_collection_status;
                  const cashPending = isCashJob && cashStatus !== 'collected' && cashStatus !== 'returned';
                  if (cashPending && task.type === 'DROPOFF') {
                    return (
                      <div className="mt-3 bg-amber-50 border-2 border-amber-300 rounded-lg p-3 flex items-start gap-2">
                        <Banknote className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-amber-900">Cash collection required</p>
                          <p className="text-xs text-amber-700">
                            Collect cash and get recipient signature at pickup before continuing to delivery.
                          </p>
                          <button
                            onClick={() => {
                              setCashConfirmJobId(job.id);
                              setCashConfirmAmount((job as any).cash_to_return_amount || 0);
                              setShowCashConfirmModal(true);
                            }}
                            className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            Collect Cash Now
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* FLEXIBLE ROUTE: Change Destination */}
              {wizardState.routeType === 'FLEXIBLE' && wizardState.currentTask.type === 'DROPOFF' && (
                <button
                  onClick={async () => {
                    const { error } = await supabase
                      .from('jobs')
                      .update({ current_selected_stop_id: null })
                      .eq('id', job.id);

                    if (!error && courier?.id) {
                      await fetchJobs(courier.id, 'active', true);
                      addNotification('You can now select a different stop', 'info');
                    }
                  }}
                  className="w-full mt-3 py-3 px-4 bg-white border-2 border-orange-500 hover:border-orange-600 hover:bg-orange-50 text-orange-700 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  Change Destination
                </button>
              )}
            </>
          ) : null}
        </div>

        {/* ============================ */}
        {/* READ-ONLY SECTIONS (COLLAPSED) */}
        {/* ============================ */}
        <div className="p-4">

          {/* ▶ ROUTE OVERVIEW (Read-Only, Collapsed by default) */}
          {wizardState.tasks.length > 0 && (
            <details className="mb-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
              <summary className="cursor-pointer px-4 py-3 font-semibold text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
                <span className="text-gray-400">▶</span>
                <Navigation className="w-4 h-4 text-gray-600" />
                Route Overview
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-3 bg-gray-50">
                {wizardState.tasks.filter(t => t.type === 'PICKUP').length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-700 mb-2">Pickups:</p>
                    {wizardState.tasks.filter(t => t.type === 'PICKUP').map((task) => {
                      const isCurrent = wizardState.currentTask?.taskId === task.taskId;
                      return (
                        <div key={task.taskId} className={`flex items-start gap-3 mb-2 p-2 rounded-lg ${isCurrent ? 'bg-blue-100 border-2 border-blue-400' : ''}`}>
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              task.status === 'COLLECTED' ? 'bg-green-600' : isCurrent ? 'bg-blue-600' : 'bg-gray-400'
                            }`}>
                              {task.status === 'COLLECTED' ? (
                                <CheckCircle className="w-5 h-5 text-white" />
                              ) : (
                                <span className="text-white text-xs font-bold">P{task.index}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm text-gray-900 font-medium">{task.address}</p>
                              {task.status === 'COLLECTED' && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">Collected</span>
                              )}
                              {task.status === 'ARRIVED' && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">Arrived</span>
                              )}
                              {task.status === 'ENROUTE' && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">En Route</span>
                              )}
                            </div>
                            {task.contactName && (
                              <p className="text-xs text-gray-600 mt-0.5">Contact: {task.contactName}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {wizardState.tasks.filter(t => t.type === 'PICKUP').length > 0 && wizardState.tasks.filter(t => t.type === 'DROPOFF').length > 0 && (
                  <div className="border-t border-gray-200 my-2"></div>
                )}

                {wizardState.tasks.filter(t => t.type === 'DROPOFF').length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-700 mb-2">Drop-offs:</p>
                    {wizardState.tasks.filter(t => t.type === 'DROPOFF').map((task) => {
                      const isCurrent = wizardState.currentTask?.taskId === task.taskId;
                      return (
                        <div key={task.taskId} className={`flex items-start gap-3 mb-2 p-2 rounded-lg ${isCurrent ? 'bg-blue-100 border-2 border-blue-400' : ''}`}>
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              task.status === 'DELIVERED' ? 'bg-green-600' : isCurrent ? 'bg-blue-600' : 'bg-gray-400'
                            }`}>
                              {task.status === 'DELIVERED' ? (
                                <CheckCircle className="w-5 h-5 text-white" />
                              ) : (
                                <span className="text-white text-xs font-bold">{task.index}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm text-gray-900 font-medium">{task.address}</p>
                              {task.status === 'DELIVERED' && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">Delivered</span>
                              )}
                              {task.status === 'ARRIVED' && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">Arrived</span>
                              )}
                              {task.status === 'ENROUTE' && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">En Route</span>
                              )}
                            </div>
                            {task.contactName && (
                              <p className="text-xs text-gray-600 mt-0.5">Contact: {task.contactName}</p>
                            )}
                            {task.cargoSummary && (
                              <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                                <Package className="w-3 h-3" />
                                {task.cargoSummary}
                              </p>
                            )}
                            {task.podRequirement !== 'NONE' && (
                              <div className="flex items-center gap-1 mt-1">
                                {task.hasPodPhoto && task.hasPodSignature ? (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">POD Complete</span>
                                ) : task.status === 'DELIVERED' ? (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">POD Complete</span>
                                ) : isCurrent ? (
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">POD Required (see above)</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">POD Required</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* ▶ CARGO DETAILS (Read-Only, Collapsed by default) */}
          {job.cargo_items && job.cargo_items.length > 0 && (
            <details className="mb-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
              <summary className="cursor-pointer px-4 py-3 font-semibold text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
                <span className="text-gray-400">▶</span>
                <Package className="w-4 h-4 text-gray-600" />
                Cargo Details ({job.cargo_items.length} {job.cargo_items.length === 1 ? 'item' : 'items'})
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-3 bg-gray-50">
                {job.cargo_items.map((item, idx) => {
                  const isDelivered = item.status === 'delivered';

                  return (
                    <div
                      key={item.id}
                      className={`bg-white p-3 rounded-lg border-2 ${
                        isDelivered ? 'border-green-300 bg-green-50' : 'border-gray-300'
                      }`}
                    >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-gray-900">Item {idx + 1}</p>
                            {isDelivered ? (
                              <span className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-full text-xs font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                Delivered
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-xs">
                            {/* Type and Size */}
                            <div className="flex flex-wrap gap-2">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium capitalize">
                                {item.cargo_size_category}
                              </span>
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium capitalize">
                                {item.cargo_category === 'other' ? item.cargo_category_custom : item.cargo_category}
                              </span>
                              {item.cargo_weight_kg && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-medium flex items-center gap-1">
                                  <Dumbbell className="w-3 h-3" />
                                  {Number(item.cargo_weight_kg) % 1 === 0 ? Math.round(item.cargo_weight_kg) : Number(item.cargo_weight_kg).toFixed(1)} kg
                                </span>
                              )}
                            </div>

                            {/* Dimensions */}
                            {(item.cargo_length || item.cargo_width || item.cargo_height) && (
                              <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                                <span className="font-semibold">Dimensions:</span>{' '}
                                {item.cargo_length && `L: ${item.cargo_length}cm`}
                                {item.cargo_width && ` × W: ${item.cargo_width}cm`}
                                {item.cargo_height && ` × H: ${item.cargo_height}cm`}
                              </div>
                            )}

                            {/* Quantity */}
                            {item.quantity && item.quantity > 1 && (
                              <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                                <span className="font-semibold">Quantity:</span> {item.quantity} units
                              </div>
                            )}

                            {/* Flags */}
                            {(item.is_fragile || item.keep_upright || item.needs_cover || item.requires_heavy_lift) && (
                              <div className="flex flex-wrap gap-1">
                                {item.is_fragile && (
                                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Fragile
                                  </span>
                                )}
                                {item.keep_upright && (
                                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                                    Keep Upright
                                  </span>
                                )}
                                {item.needs_cover && (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                                    Needs Cover
                                  </span>
                                )}
                                {item.requires_heavy_lift && (
                                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium flex items-center gap-1">
                                    <Dumbbell className="w-3 h-3" />
                                    Heavy Lift
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Photo */}
                            {item.cargo_photo_url && (
                              <div className="mt-2">
                                <p className="font-semibold mb-1">Cargo Photo:</p>
                                <img
                                  src={item.cargo_photo_url}
                                  alt={`Cargo item ${idx + 1}`}
                                  className="w-full h-48 object-cover rounded-lg border border-gray-300"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}

                            {/* Instructions */}
                            {item.cargo_notes && (
                              <div className="text-xs text-gray-700 bg-yellow-50 p-2 rounded border border-yellow-200">
                                <span className="font-semibold">Delivery Instructions:</span> {item.cargo_notes}
                              </div>
                            )}

                            {/* Dropoff Location for this item */}
                            {item.dropoff_location_text && (
                              <div className="mt-2 pt-2 border-t border-orange-200">
                                <div className="flex items-start gap-1 mb-1">
                                  <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="font-semibold text-gray-900">{item.dropoff_location_text}</p>
                                    {item.dropoff_contact_name && (
                                      <p className="text-gray-600 mt-0.5">Contact: {item.dropoff_contact_name}</p>
                                    )}
                                    {item.dropoff_contact_phone && (
                                      <p className="text-gray-600">Phone: {item.dropoff_contact_phone}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

          {/* POD upload is now handled in the Driver Cockpit above */}
        </div>
      </div>
    );
  };


  if (loading && !courier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {chatConversationId && (
        <div className="fixed inset-0 bg-white z-[60]">
          <ChatView
            conversationId={chatConversationId}
            onBack={() => setChatConversationId(null)}
          />
        </div>
      )}
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onClose={() => removeNotification(notification.id)}
        />
      ))}

      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Jobs</h1>

          <div className="flex gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
            {!isCompanyDriver && (
              <button
                onClick={() => setActiveTab('available')}
                className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  activeTab === 'available'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 hidden sm:block" />
                Available
                {availableJobs.length > 0 && (
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                    activeTab === 'available' ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {availableJobs.length}
                  </span>
                )}
              </button>
            )}

            {!isCompanyDriver && (
              <button
                onClick={() => setActiveTab('bids')}
                className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  activeTab === 'bids'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 hidden sm:block" />
                Bids
                {biddedJobs.length > 0 && (
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                    activeTab === 'bids' ? 'bg-white text-green-600' : 'bg-green-100 text-green-700'
                  }`}>
                    {biddedJobs.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                activeTab === 'active'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 hidden sm:block" />
              Active
              {activeJobs.length > 0 && (
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                  activeTab === 'active' ? 'bg-white text-orange-600' : 'bg-orange-100 text-orange-700'
                }`}>
                  {activeJobs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                activeTab === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 hidden sm:block" />
              Done
              {completedJobs.length > 0 && (
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                  activeTab === 'completed' ? 'bg-white text-green-600' : 'bg-green-100 text-green-700'
                }`}>
                  {completedJobs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {!isMobileDevice() && (
          <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                <Phone className="w-5 h-5 text-red-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-900">Mobile Device Required</h3>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  You must use a mobile device to accept jobs and update delivery status.
                  GPS tracking and real-time updates require mobile access. Please switch to your phone.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'available' && !isCompanyDriver && (
          <div>
            {cashReturnJobs.length > 0 && !isCompanyDriver && (
              <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-start gap-3">
                <Banknote className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 mb-1">Cash Return Pending</p>
                  <p className="text-sm text-amber-800 mb-2">
                    You have TTD ${cashReturnJobs.reduce((s, j) => s + (j.cash_to_return_amount || 0), 0).toLocaleString()} in cash to return.
                    You cannot accept new jobs until all cash is delivered back.
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab('active');
                      const params = new URLSearchParams(window.location.search);
                      params.set('tab', 'active');
                      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                    }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors flex items-center gap-2 text-sm"
                  >
                    <Banknote className="w-4 h-4" />
                    Go to Active Jobs
                  </button>
                </div>
              </div>
            )}
            {!hasBankInfo && !checkingBank && !isCompanyDriver && (
              <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900 mb-1">Bank Account Required</p>
                  <p className="text-sm text-red-800 mb-3">
                    You need to add your bank account information before you can bid on jobs or receive payments.
                  </p>
                  <button
                    onClick={() => setShowBankModal(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <Building2 className="w-4 h-4" />
                    Add Bank Account
                  </button>
                </div>
              </div>
            )}

            {hasBankInfo && !bankVerified && !checkingBank && !isCompanyDriver && (
              <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900 mb-1">Bank Account Pending Verification</p>
                  <p className="text-sm text-amber-800">
                    Your bank account is pending admin verification. Once verified, you'll be able to bid on jobs and receive payments.
                  </p>
                </div>
              </div>
            )}

            {bankVerified && !checkingBank && !isCompanyDriver && (
              <div className="mb-4 p-4 bg-green-50 border-2 border-green-300 rounded-xl flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-900 mb-1">Bank Account Verified</p>
                  <p className="text-sm text-green-800">
                    Your bank account has been verified. You can now bid on jobs and receive payments.
                  </p>
                </div>
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <p className="text-sm font-semibold text-gray-700">Filter Jobs</p>
              </div>
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Jobs
                </button>
                <button
                  onClick={() => setActiveFilter('near_me')}
                  disabled={!courierLocation}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeFilter === 'near_me'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${!courierLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Near Me
                </button>
                {!isCompanyDriver && (
                  <button
                    onClick={() => setActiveFilter('highest_price')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      activeFilter === 'highest_price'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Highest Price
                  </button>
                )}
                <button
                  onClick={() => setActiveFilter('bids_only')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeFilter === 'bids_only'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  Bids Only
                </button>
                <button
                  onClick={() => setActiveFilter('big_cargo')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeFilter === 'big_cargo'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Big Cargo
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1 flex-shrink-0" />
                {ALL_JOB_TYPES.filter(t => t.id !== 'standard').map(t => {
                  const IconMap = { Package, Bike, ShoppingBag, Trash2, ShoppingCart };
                  const info = getJobTypeInfo(t.id);
                  const Icon = IconMap[info.iconName];
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveFilter(t.id as FilterType)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                        activeFilter === t.id
                          ? `${info.badgeBg} ${info.badgeText} border ${info.badgeBorder}`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {(() => {
              if (!tabsLoaded.available) {
                return (
                  <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading jobs...</h3>
                  </div>
                );
              }

              const filteredJobs = getFilteredAndSortedJobs();

              let backhaulMatches: any[] = [];
              if (profile?.home_base_lat && profile?.home_base_lng) {
                const homeBase = {
                  lat: profile.home_base_lat,
                  lng: profile.home_base_lng,
                  text: profile.home_base_location_text || 'Home'
                };

                let currentLocation = homeBase;

                if (activeJobs.length > 0) {
                  const activeJob = activeJobs[0];
                  if (activeJob.route_type === 'multi_stop' && activeJob.delivery_stops) {
                    const dropoffStops = activeJob.delivery_stops
                      .filter(s => s.stop_type === 'DROPOFF')
                      .sort((a, b) => b.stop_index - a.stop_index);

                    if (dropoffStops.length > 0 && dropoffStops[0].location_lat && dropoffStops[0].location_lng) {
                      currentLocation = {
                        lat: dropoffStops[0].location_lat,
                        lng: dropoffStops[0].location_lng,
                        text: dropoffStops[0].location_text
                      };
                    }
                  } else if (activeJob.dropoff_lat && activeJob.dropoff_lng) {
                    currentLocation = {
                      lat: Number(activeJob.dropoff_lat),
                      lng: Number(activeJob.dropoff_lng),
                      text: activeJob.dropoff_location_text || ''
                    };
                  }
                }

                backhaulMatches = findBackhaulMatches(
                  currentLocation,
                  homeBase,
                  availableJobs as any[],
                  activeJobs.length > 0 ? 15 : 50,
                  25
                );
              }

              if (availableJobs.length === 0) {
                return (
                  <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs available</h3>
                    <p className="text-gray-600">Check back soon for new delivery opportunities</p>
                  </div>
                );
              }

              if (filteredJobs.length === 0) {
                return (
                  <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                    <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs match your filter</h3>
                    <p className="text-gray-600 mb-4">Try selecting a different filter option</p>
                    <button
                      onClick={() => setActiveFilter('all')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      View All Jobs
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {/* BACKHAUL OPPORTUNITY ALERT - Only shown when there's a match */}
                  {backhaulMatches.length > 0 && (
                    <BackhaulOpportunityAlert
                      match={backhaulMatches[0]}
                      onAccept={(jobId) => handleAcceptBackhaulJob(jobId)}
                    />
                  )}

                  {filteredJobs.map((job) => renderJobCard(job, false))}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'bids' && !isCompanyDriver && (
          <div>
            {!tabsLoaded.bids ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading bids...</h3>
              </div>
            ) : biddedJobs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No active bids</h3>
                <p className="text-gray-600">Place bids on available jobs to see them here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {biddedJobs.map((job) => renderJobCard(job, true))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'active' && (
          <div>
            {cashReturnJobs.length > 0 && !isCompanyDriver && (
              <CashReturnBanner
                jobs={cashReturnJobs}
                onNavigate={onNavigate}
                onCashReturned={() => {
                  fetchCashReturnJobs();
                  if (courier?.id) {
                    fetchJobs(courier.id, 'active', true);
                  }
                  addNotification('Cash returned successfully! You can now accept new jobs.', 'success');
                }}
              />
            )}
            {!tabsLoaded.active ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading active jobs...</h3>
              </div>
            ) : activeJobs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No active jobs</h3>
                <p className="text-gray-600">Jobs you've been assigned will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeJobs.map((job) => renderActiveJobCard(job))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div>
            {!tabsLoaded.completed ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading completed jobs...</h3>
              </div>
            ) : completedJobs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No completed jobs</h3>
                <p className="text-gray-600">Completed jobs will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedJobs.map((job) => (
                  <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700">
                            Completed
                          </div>
                          {(() => {
                            const jt = getJobTypeInfo((job as any).job_type);
                            const IconMap = { Package, Bike, ShoppingBag, Trash2, ShoppingCart };
                            const Icon = IconMap[jt.iconName];
                            return (job as any).job_type && (job as any).job_type !== 'standard' ? (
                              <div className={`flex items-center gap-1 ${jt.badgeBg} ${jt.badgeText} px-2 py-0.5 rounded-full border ${jt.badgeBorder}`}>
                                <Icon className="w-3 h-3" />
                                <span className="text-xs font-bold">{jt.shortLabel}</span>
                              </div>
                            ) : null;
                          })()}
                        </div>
                        {!isCompanyDriver && (
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">TTD ${job.customer_offer_ttd}</p>
                            <p className="text-xs text-gray-600">Earned</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 mb-4">
                        {/* Cargo Information */}
                        {job.cargo_items && job.cargo_items.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-3 mb-2">
                            <p className="text-xs text-gray-600 font-semibold mb-2">Cargo:</p>
                            {job.cargo_items.map((item, idx) => (
                              <div key={item.id} className="flex items-center gap-2 mb-1">
                                <Package className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                                <span className="text-xs text-gray-900">
                                  {idx + 1}. {item.cargo_category === 'other' ? item.cargo_category_custom : item.cargo_category}
                                  {' '}- {item.cargo_size_category}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 font-medium">Pickup</p>
                            <p className="text-sm text-gray-900">{job.pickup_location_text}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 font-medium">Dropoff</p>
                            <p className="text-sm text-gray-900">{job.dropoff_location_text}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 pt-2">
                          <div className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            <span className="capitalize">{job.cargo_size_category}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>{job.distance_km} km</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Completed: {new Date(job.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {job.customer_profile && (
                        <div className="text-xs text-gray-600 pt-3 border-t border-gray-200">
                          <span className="font-medium">Customer:</span> {job.customer_profile.full_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!isCompanyDriver && (
        <AddBankAccountModal
          isOpen={showBankModal}
          onClose={() => setShowBankModal(false)}
          onSuccess={() => {
            setHasBankInfo(true);
            setShowBankModal(false);
            fetchCourierAndJobs();
            addNotification('Bank account added successfully! Awaiting admin verification.', 'success');
          }}
        />
      )}

      {!isCompanyDriver && showDeliveryProofModal && selectedCargoItem && (
        <DeliveryProofModal
          jobId={selectedCargoItem.jobId}
          cargoItemId={selectedCargoItem.cargoItemId}
          cargoDescription={selectedCargoItem.description}
          onComplete={() => {
            setShowDeliveryProofModal(false);
            setSelectedCargoItem(null);
            addNotification('Delivery proof submitted successfully!', 'success');
            if (courier?.id) {
              fetchJobs(courier.id, 'active', true);
            }
          }}
          onCancel={() => {
            setShowDeliveryProofModal(false);
            setSelectedCargoItem(null);
          }}
        />
      )}

      {!isCompanyDriver && (
        <AcceptJobModal
          isOpen={showAcceptJobModal}
          job={selectedJob}
          onClose={() => {
            setShowAcceptJobModal(false);
            setSelectedJob(null);
          }}
          onConfirm={acceptJob}
          loading={acceptingJob}
        />
      )}

      {!isCompanyDriver && (
        <CounterOfferModal
          isOpen={showCounterOfferModal}
          jobPrice={selectedJob?.customer_offer_ttd || 0}
          onClose={() => {
            setShowCounterOfferModal(false);
            setSelectedJob(null);
          }}
          onSubmit={submitCounterOffer}
        />
      )}

      {/* Stop Selector Modal for FLEXIBLE routing */}
      {showStopSelector && selectingStopForJob && (() => {
        const job = activeJobs.find(j => j.id === selectingStopForJob);
        if (!job) return null;

        const stopOptions = getAvailableStopOptions({
          ...job,
          delivery_stops: job.delivery_stops,
          cargo_items: job.cargo_items
        });

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Choose Next Delivery Stop</h2>
                <button
                  onClick={() => {
                    setShowStopSelector(false);
                    setSelectingStopForJob(null);
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-4">
                {stopOptions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">All delivery stops have been completed!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stopOptions.map((stop) => (
                      <button
                        key={stop.stopId}
                        onClick={() => handleSelectStop(selectingStopForJob, stop.stopId)}
                        className="w-full p-4 bg-gray-50 hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-400 rounded-lg transition-all text-left"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                            {stop.stopNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 mb-1">Stop {stop.stopNumber}</p>
                            <p className="text-sm text-gray-700 mb-2">{stop.address}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                              <Package className="w-4 h-4 text-blue-600" />
                              <span className="font-medium">{stop.cargoSummary}</span>
                            </div>
                          </div>
                          <Navigation className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setShowStopSelector(false);
                    setSelectingStopForJob(null);
                  }}
                  className="w-full py-3 px-4 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delivery Completion Modal */}
      {showCompletionModal && completionModalData && (
        <DeliveryCompletionModal
          jobId={completionModalData.jobId}
          stopId={completionModalData.stopId}
          stopAddress={completionModalData.stopAddress}
          stopType={completionModalData.stopType}
          podStop={completionModalData.podStop}
          podRequired={completionModalData.podRequired}
          onComplete={async () => {
            const jobId = completionModalData.jobId;
            const stopId = completionModalData.stopId;
            const stopType = completionModalData.stopType;
            const completionTime = new Date().toISOString();

            setActiveJobs(prevJobs => prevJobs.map(job => {
              if (job.id !== jobId) return job;

              return {
                ...job,
                delivery_stops: job.delivery_stops?.map(stop => {
                  if (stop.id !== stopId) return stop;

                  return {
                    ...stop,
                    status: 'COMPLETED' as const,
                    completed_at: completionTime,
                    updated_at: completionTime
                  };
                })
              };
            }));

            setShowCompletionModal(false);
            setCompletionModalData(null);

            if (stopType === 'PICKUP') {
              const job = activeJobs.find(j => j.id === jobId);
              if (job && (job as any).cash_to_return && (job as any).cash_collection_status !== 'collected' && (job as any).cash_collection_status !== 'returned') {
                setCashConfirmJobId(jobId);
                setCashConfirmAmount((job as any).cash_to_return_amount || 0);
                setShowCashConfirmModal(true);
              }
            }

            if (courier?.id) {
              await fetchJobs(courier.id, 'active', true);
            }
          }}
          onCancel={() => {
            setShowCompletionModal(false);
            setCompletionModalData(null);
          }}
          onNotification={addNotification}
        />
      )}

      {showPodGateModal && podGateData && (
        <PodGateModal
          jobId={podGateData.jobId}
          stopId={podGateData.stopId}
          stopAddress={podGateData.stopAddress}
          podStop={podGateData.podStop}
          podRequired={podGateData.podRequired}
          onPodComplete={(updatedPodStop) => {
            setPodCollectedStops(prev => new Set(prev).add(podGateData.stopId));
            setActiveJobs(prevJobs => prevJobs.map(job => {
              if (job.id !== podGateData.jobId) return job;
              const existingPodStops = (job as any).pod_stops || [];
              const idx = existingPodStops.findIndex((p: any) => p.stop_id === podGateData.stopId);
              const updatedPodStops = idx >= 0
                ? existingPodStops.map((p: any, i: number) => i === idx ? updatedPodStop : p)
                : [...existingPodStops, updatedPodStop];
              return { ...job, pod_stops: updatedPodStops };
            }));
            setShowPodGateModal(false);
            setPodGateData(null);
            addNotification('POD collected! You can now complete delivery.', 'success');
            if (courier?.id) {
              fetchJobs(courier.id, 'active', true);
            }
          }}
          onDismiss={() => {
            setShowPodGateModal(false);
            setPodGateData(null);
          }}
          onNotification={addNotification}
        />
      )}

      {showReturnModal && returnModalJobId && (() => {
        const returnJob = activeJobs.find(j => j.id === returnModalJobId);
        if (!returnJob) return null;
        const pickupStops = (returnJob.delivery_stops || []).filter(s => s.stop_type === 'PICKUP');
        const pickupLocation = pickupStops[0]?.location_text || (returnJob as any).pickup_location_text || 'Original pickup';
        return (
          <ReturnItemModal
            jobId={returnModalJobId}
            originalFare={returnJob.customer_offer_ttd || 0}
            pickupLocation={pickupLocation}
            hideFinancial={isCompanyDriver}
            onConfirm={handleInitiateReturn}
            onClose={() => {
              setShowReturnModal(false);
              setReturnModalJobId(null);
            }}
          />
        );
      })()}

      {showSaveLocationModal && saveLocationData && (
        <SaveLocationModal
          isOpen={showSaveLocationModal}
          onClose={() => {
            setShowSaveLocationModal(false);
            setSaveLocationData(null);
          }}
          address={saveLocationData.address}
          latitude={saveLocationData.latitude}
          longitude={saveLocationData.longitude}
          onSaved={() => {
            addNotification('Location saved successfully!', 'success');
          }}
        />
      )}

      {backhaulModalMatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full animate-in">
            <BackhaulOpportunityAlert
              match={backhaulModalMatch}
              onAccept={(jobId) => {
                setBackhaulModalMatch(null);
                handleAcceptBackhaulJob(jobId);
              }}
            />
            <button
              onClick={() => setBackhaulModalMatch(null)}
              className="w-full mt-3 py-3 px-4 bg-white/90 text-gray-700 rounded-xl font-semibold hover:bg-white transition-all text-center"
            >
              No Thanks
            </button>
          </div>
        </div>
      )}

      {showCashDeliveryModal && cashDeliveryData && (
        <CashDeliveryModal
          jobId={cashDeliveryData.jobId}
          stopId={cashDeliveryData.stopId}
          stopAddress={cashDeliveryData.stopAddress}
          cashAmount={cashDeliveryData.cashAmount}
          podRequired={cashDeliveryData.podRequired}
          podStopId={cashDeliveryData.podStopId}
          onComplete={async () => {
            setShowCashDeliveryModal(false);

            setActiveJobs(prevJobs => prevJobs.map(job => {
              if (job.id !== cashDeliveryData.jobId) return job;
              return {
                ...job,
                delivery_stops: job.delivery_stops?.map(stop => {
                  if (stop.id !== cashDeliveryData.stopId) return stop;
                  return { ...stop, status: 'COMPLETED' as const, completed_at: new Date().toISOString() };
                })
              };
            }));

            setCashDeliveryData(null);
            if (courier?.id) {
              await fetchJobs(courier.id, 'active', true);
            }
          }}
          onCancel={() => {
            setShowCashDeliveryModal(false);
            setCashDeliveryData(null);
          }}
          onNotification={addNotification}
        />
      )}

      {showCashConfirmModal && cashConfirmJobId && user && (
        <CashConfirmationModal
          jobId={cashConfirmJobId}
          expectedAmount={cashConfirmAmount}
          driverUserId={user.id}
          onConfirmed={() => {
            setShowCashConfirmModal(false);
            setCashConfirmJobId(null);
            fetchCashReturnJobs();
            if (courier?.id) {
              fetchJobs(courier.id, 'active', true);
            }
          }}
          onCancel={() => {
            setShowCashConfirmModal(false);
            setCashConfirmJobId(null);
          }}
          onNotification={addNotification}
        />
      )}
    </div>
  );
}
