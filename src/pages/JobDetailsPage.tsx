import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, MapPin, Package, Clock, DollarSign, User, Check, Loader2, MessageCircle, Navigation, Phone, Truck, CheckCircle2, FileText, AlertCircle, CreditCard as Edit2, XCircle, Image as ImageIcon, X, Gem, ShieldCheck, RotateCcw, Bike, ShoppingBag, Trash2, ShoppingCart, ExternalLink, Store, ListChecks as ListChecked, Recycle, Camera, Eye, PackageCheck, Handshake } from 'lucide-react';
import { getJobTypeInfo } from '../lib/jobTypeUtils';
import { Database } from '../lib/database.types';
import { ChatView } from '../components/messaging/ChatView';
import { LiveTrackingModal } from '../components/LiveTrackingModal';
import { LiveTrackingMap } from '../components/LiveTrackingMap';
import { CounterOfferModal } from '../components/CounterOfferModal';
import { AcceptJobModal } from '../components/AcceptJobModal';
import { ProofOfDeliveryUpload } from '../components/ProofOfDeliveryUpload';
import { NotificationToast } from '../components/NotificationToast';
import { RateDeliveryCard } from '../components/RateDeliveryCard';
import { ProviderReputation } from '../components/ProviderReputation';
import { getOrCreateJobConversation } from '../lib/messaging';
import { useAuth } from '../contexts/AuthContext';
import { buildRouteFromJob, formatProofOfDelivery, requiresESignature } from '../lib/jobRoute';
import { formatMinutesToHoursMinutes } from '../lib/timeUtils';
import { isTrackingActive, shouldShowTrackingCard } from '../lib/trackingUtils';
import { DetentionTimer } from '../components/DetentionTimer';
import { MarketplaceBuyerApproval } from '../components/MarketplaceBuyerApproval';
import { calculateCustomerFees, calculateDriverFees, formatCurrency, fetchPlatformFeePercentage, DEFAULT_PLATFORM_FEE } from '../lib/pricing';

type Job = Database['public']['Tables']['jobs']['Row'];
type CargoItem = Database['public']['Tables']['cargo_items']['Row'];
type CounterOffer = Database['public']['Tables']['counter_offers']['Row'];
type Bid = Database['public']['Tables']['bids']['Row'] & {
  couriers: {
    user_id: string;
    vehicle_type: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    profiles: {
      full_name: string | null;
      phone: string | null;
      avatar_url: string | null;
      rating_average: number | null;
      rating_count: number | null;
      completed_deliveries_count: number | null;
    };
  };
};

type CounterOfferWithCourier = CounterOffer & {
  offered_by_role: 'courier' | 'customer' | 'business';
  couriers: {
    user_id: string;
    vehicle_type: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    profiles: {
      full_name: string | null;
      phone: string | null;
      avatar_url: string | null;
      rating_average: number | null;
      rating_count: number | null;
      completed_deliveries_count: number | null;
    };
  };
};

type DeliveryStop = Database['public']['Tables']['delivery_stops']['Row'];
type PodStop = Database['public']['Tables']['pod_stops']['Row'];

interface DeliveryStopWithPod extends DeliveryStop {
  pod_stops?: PodStop;
}

interface JobWithCargo extends Job {
  cargo_items?: CargoItem[];
  delivery_stops?: DeliveryStopWithPod[];
}

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

export function JobDetailsPage({ jobId, onBack, onEdit }: { jobId: string; onBack: () => void; onEdit?: (jobId: string) => void }) {
  const { user, profile } = useAuth();
  const isCompanyDriver = !!(profile as any)?.is_company_driver;
  const [job, setJob] = useState<JobWithCargo | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [counterOffers, setCounterOffers] = useState<CounterOfferWithCourier[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
  const [rejectingOffer, setRejectingOffer] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [assignedCourier, setAssignedCourier] = useState<any>(null);
  const [showLiveTracking, setShowLiveTracking] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [highlightedOfferId, setHighlightedOfferId] = useState<string | null>(null);
  const [showCustomerCounterOfferModal, setShowCustomerCounterOfferModal] = useState(false);
  const [selectedCourierForCounter, setSelectedCourierForCounter] = useState<{courierId: string; offerId: string | null; currentAmount: number} | null>(null);
  const counterOffersRef = useRef<HTMLDivElement>(null);
  const [showCourierBidModal, setShowCourierBidModal] = useState(false);
  const [courierBidAmount, setCourierBidAmount] = useState('');
  const [courierBidMessage, setCourierBidMessage] = useState('');
  const [courierBidEtaHours, setCourierBidEtaHours] = useState('');
  const [courierBidEtaMinutes, setCourierBidEtaMinutes] = useState('');
  const [submittingCourierAction, setSubmittingCourierAction] = useState(false);
  const [showCourierCounterOfferModal, setShowCourierCounterOfferModal] = useState(false);
  const [showAcceptJobModal, setShowAcceptJobModal] = useState(false);
  const [courier, setCourier] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [platformFeePercent, setPlatformFeePercent] = useState(DEFAULT_PLATFORM_FEE);
  const [showBuyerApproval, setShowBuyerApproval] = useState(false);

  useEffect(() => {
    fetchPlatformFeePercentage().then(fee => setPlatformFeePercent(fee));
  }, []);
  const [detentionData, setDetentionData] = useState<{
    stopId: string;
    arrivedAt: string;
    vehicleType: string;
    jobBasePrice: number;
    recordId: string | null;
  } | null>(null);

  useEffect(() => {
    fetchJobDetails();
    fetchCourierProfile();
    const params = new URLSearchParams(window.location.search);
    const offerId = params.get('offerId');
    if (offerId) {
      setHighlightedOfferId(offerId);
    }
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    const isCustomerView = profile?.role === 'customer' || profile?.role === 'business';
    const isMarketplace = (job as any).job_type === 'marketplace_safebuy';
    const status = (job as any).marketplace_inspection_status;
    if (!isCustomerView || !isMarketplace || !status || status === 'buyer_approved' || status === 'buyer_rejected' || status === 'pending_inspection') return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('jobs')
        .select('marketplace_inspection_status, marketplace_inspection_photo_url')
        .eq('id', jobId)
        .maybeSingle();
      if (data && data.marketplace_inspection_status !== (job as any).marketplace_inspection_status) {
        fetchJobDetails();
        if (data.marketplace_inspection_status === 'inspection_submitted') {
          addNotification('The driver has submitted an inspection photo for your review!', 'info');
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [job, jobId]);

  const fetchCourierProfile = async () => {
    if (!user) return;
    if (profile?.role !== 'courier' && !(profile?.role === 'business' && profile?.business_type === 'haulage')) return;

    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCourier(data);
      } else if (profile?.role === 'business' && profile?.business_type === 'haulage') {
        const { data: newCourier, error: insertError } = await supabase
          .from('couriers')
          .insert({
            user_id: user.id,
            vehicle_type: 'fleet',
            vehicle_make: 'Haulage Fleet',
            vehicle_model: 'Multiple Vehicles',
            vehicle_year: new Date().getFullYear(),
            vehicle_plate: 'FLEET',
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (newCourier) setCourier(newCourier);
      }
    } catch (error) {
      console.error('Error fetching courier profile:', error);
    }
  };

  const addNotification = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => {
    if (highlightedOfferId && counterOffersRef.current) {
      setTimeout(() => {
        counterOffersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [highlightedOfferId, counterOffers]);

  const resolveCargoImageUrl = (cargo: CargoItem): string | null => {
    const photoUrl = cargo.cargo_photo_url;

    if (!photoUrl) return null;

    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return photoUrl;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('cargo-photos')
      .getPublicUrl(photoUrl);

    return publicUrl;
  };

  const fetchJobDetails = async () => {
    try {
      console.log('🔍 Fetching job with ID:', jobId);
      console.log('👤 Current user ID:', user?.id);

      // First, try to fetch just the job without nested relations
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();

      if (jobError) {
        console.error('❌ Error fetching job:', jobError);
        console.error('❌ ERROR MESSAGE:', jobError.message);
        console.error('❌ ERROR CODE:', jobError.code);
        console.error('❌ ERROR DETAILS:', jobError.details);
        console.error('❌ ERROR HINT:', jobError.hint);
        alert(`Error fetching job: ${jobError.message}\nCode: ${jobError.code}\nDetails: ${jobError.details || 'N/A'}`);
        throw jobError;
      }

      if (!jobData) {
        console.error('❌ No job data returned');
        throw new Error('Job not found');
      }

      console.log('✅ Job data loaded:', {
        jobId: jobData.id,
        customerId: jobData.customer_user_id,
        status: jobData.status
      });

      // Now fetch cargo_items separately
      const { data: cargoData, error: cargoError } = await supabase
        .from('cargo_items')
        .select('*')
        .eq('job_id', jobId);

      if (cargoError) {
        console.error('⚠️ Error fetching cargo items:', cargoError.message);
      } else {
        jobData.cargo_items = cargoData || [];
        console.log('✅ Cargo items loaded:', cargoData?.length || 0);
      }

      // Fetch delivery_stops with pod_stops separately
      const { data: stopsData, error: stopsError } = await supabase
        .from('delivery_stops')
        .select(`
          *,
          pod_stops(*)
        `)
        .eq('job_id', jobId)
        .order('stop_index', { ascending: true });

      if (stopsError) {
        console.error('⚠️ Error fetching delivery stops:', stopsError.message);
      } else {
        jobData.delivery_stops = stopsData || [];
        console.log('✅ Delivery stops loaded:', stopsData?.length || 0);
      }

      // Process cargo items with resolved image URLs
      if (jobData?.cargo_items && jobData.cargo_items.length > 0) {
        jobData.cargo_items = jobData.cargo_items.map((item: CargoItem) => ({
          ...item,
          cargo_photo_url: resolveCargoImageUrl(item)
        }));
      }

      setJob(jobData);

      const arrivedPickup = (stopsData || []).find(
        (s: any) => s.stop_type === 'PICKUP' && s.status === 'ARRIVED' && s.arrived_at
      );
      if (arrivedPickup) {
        const { data: dr } = await supabase
          .from('detention_records')
          .select('id, arrived_at, vehicle_type, job_base_price')
          .eq('job_id', jobId)
          .eq('stop_id', arrivedPickup.id)
          .eq('status', 'active')
          .maybeSingle();

        if (dr) {
          setDetentionData({
            stopId: arrivedPickup.id,
            arrivedAt: dr.arrived_at,
            vehicleType: dr.vehicle_type,
            jobBasePrice: dr.job_base_price,
            recordId: dr.id,
          });
        }
      } else {
        setDetentionData(null);
      }

      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select(`
          *,
          couriers!bids_courier_id_fkey (
            user_id,
            vehicle_type,
            vehicle_make,
            vehicle_model,
            profiles!couriers_user_id_fkey (
              full_name,
              phone,
              avatar_url,
              rating_average,
              rating_count,
              completed_deliveries_count
            )
          )
        `)
        .eq('job_id', jobId)
        .eq('status', 'active')
        .order('amount_ttd', { ascending: true });

      if (bidsError) throw bidsError;
      console.log('📊 Bids with explicit FK:', bidsData);
      setBids(bidsData as Bid[]);

      const { data: counterOffersData, error: counterOffersError } = await supabase
        .from('counter_offers')
        .select(`
          *,
          couriers!counter_offers_courier_id_fkey (
            user_id,
            vehicle_type,
            vehicle_make,
            vehicle_model,
            profiles!couriers_user_id_fkey (
              full_name,
              phone,
              avatar_url,
              rating_average,
              rating_count,
              completed_deliveries_count
            )
          )
        `)
        .eq('job_id', jobId)
        .in('status', ['pending', 'countered'])
        .order('created_at', { ascending: false });

      if (counterOffersError) throw counterOffersError;
      console.log('📊 Counter offers with explicit FK:', counterOffersData);
      if (counterOffersData && counterOffersData.length > 0) {
        console.log('First counter offer structure:', {
          couriers: counterOffersData[0].couriers,
          profiles: counterOffersData[0].couriers?.profiles,
          rating_average: counterOffersData[0].couriers?.profiles?.rating_average,
          rating_count: counterOffersData[0].couriers?.profiles?.rating_count,
          completed_deliveries: counterOffersData[0].couriers?.profiles?.completed_deliveries_count
        });
      }
      setCounterOffers(counterOffersData as CounterOfferWithCourier[]);

      if (jobData.assigned_courier_id) {
        console.log('🚚 DEBUG: Fetching courier with ID:', jobData.assigned_courier_id);
        const { data: courierData, error: courierError } = await supabase
          .from('couriers')
          .select(`
            user_id,
            vehicle_type,
            vehicle_make,
            vehicle_model,
            vehicle_plate,
            profiles!couriers_user_id_fkey (
              full_name,
              phone,
              avatar_url,
              rating_average,
              rating_count,
              completed_deliveries_count
            )
          `)
          .eq('id', jobData.assigned_courier_id)
          .single();

        if (courierError) {
          console.error('❌ Error fetching courier:', courierError);
        } else {
          console.log('✅ Courier data loaded:', courierData?.profiles?.full_name);
          setAssignedCourier(courierData);
        }
      } else {
        console.log('⚠️ No assigned courier ID on job');
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptBid = async (bidId: string, courierId: string) => {
    setAccepting(bidId);
    try {
      await supabase
        .from('bids')
        .update({ status: 'accepted' })
        .eq('id', bidId);

      await supabase
        .from('jobs')
        .update({
          status: 'assigned',
          assigned_courier_id: courierId,
        })
        .eq('id', jobId);

      await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('job_id', jobId)
        .neq('id', bidId);

      fetchJobDetails();
    } catch (error) {
      console.error('Error accepting bid:', error);
    } finally {
      setAccepting(null);
    }
  };

  const acceptCounterOffer = async (offerId: string, courierId: string, amount: number) => {
    setAcceptingOffer(offerId);
    try {
      await supabase
        .from('counter_offers')
        .update({ status: 'accepted' })
        .eq('id', offerId);

      await supabase
        .from('jobs')
        .update({
          status: 'assigned',
          assigned_courier_id: courierId,
          customer_offer_ttd: amount,
        })
        .eq('id', jobId);

      await supabase
        .from('counter_offers')
        .update({ status: 'rejected' })
        .eq('job_id', jobId)
        .neq('id', offerId);

      fetchJobDetails();
    } catch (error) {
      console.error('Error accepting counter offer:', error);
      addNotification('Failed to accept counter offer. Please try again.', 'warning');
    } finally {
      setAcceptingOffer(null);
    }
  };

  const rejectCounterOffer = async (offerId: string) => {
    setRejectingOffer(offerId);
    try {
      await supabase
        .from('counter_offers')
        .update({ status: 'rejected' })
        .eq('id', offerId);

      fetchJobDetails();
    } catch (error) {
      console.error('Error rejecting counter offer:', error);
      addNotification('Failed to reject counter offer. Please try again.', 'warning');
    } finally {
      setRejectingOffer(null);
    }
  };

  const handleCustomerCounterOffer = (courierId: string, offerId: string | null, currentAmount: number) => {
    setSelectedCourierForCounter({ courierId, offerId, currentAmount });
    setShowCustomerCounterOfferModal(true);
  };

  const handleCourierPlaceBid = async () => {
    if (!courier || !courierBidAmount || parseFloat(courierBidAmount) <= 0) {
      addNotification('Please enter a valid bid amount', 'warning');
      return;
    }

    setSubmittingCourierAction(true);
    try {
      const existingBid = bids.find(bid => bid.courier_id === courier.id);

      if (existingBid) {
        const { error } = await supabase
          .from('bids')
          .update({
            amount_ttd: parseFloat(courierBidAmount),
            message: courierBidMessage,
            eta_minutes: (courierBidEtaHours || courierBidEtaMinutes) ? ((Number(courierBidEtaHours) || 0) * 60) + (Number(courierBidEtaMinutes) || 0) : null,
          })
          .eq('id', existingBid.id);

        if (error) throw error;
        addNotification('Bid updated successfully!', 'success');
      } else {
        const { error } = await supabase
          .from('bids')
          .insert({
            job_id: jobId,
            courier_id: courier.id,
            amount_ttd: parseFloat(courierBidAmount),
            message: courierBidMessage,
            eta_minutes: (courierBidEtaHours || courierBidEtaMinutes) ? ((Number(courierBidEtaHours) || 0) * 60) + (Number(courierBidEtaMinutes) || 0) : null,
            status: 'active',
          });

        if (error) throw error;
        addNotification('Bid placed successfully!', 'success');
      }

      setCourierBidAmount('');
      setCourierBidMessage('');
      setCourierBidEtaHours('');
      setCourierBidEtaMinutes('');
      setShowCourierBidModal(false);
      fetchJobDetails();
    } catch (error: any) {
      console.error('Error placing/updating bid:', error);
      const msg = error?.message?.includes('row-level security')
        ? 'Your courier account must be approved before placing bids.'
        : 'Failed to place/update bid. Please try again.';
      addNotification(msg, 'warning');
    } finally {
      setSubmittingCourierAction(false);
    }
  };

  const createPickupReminder = async (job: JobWithCargo, userId: string) => {
    try {
      const pickupTime = new Date(job.scheduled_pickup_time!);
      const now = new Date();
      const hoursUntilPickup = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      let reminderTime: Date;
      if (hoursUntilPickup > 3) {
        reminderTime = new Date(pickupTime.getTime() - 3 * 60 * 60 * 1000);
      } else if (hoursUntilPickup > 0.5) {
        reminderTime = new Date(pickupTime.getTime() - 30 * 60 * 1000);
      } else {
        return;
      }

      const jobIdShort = job.id.substring(0, 8);
      const pickupTimeStr = pickupTime.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Upcoming Pickup Reminder',
        message: `Pickup for job ${jobIdShort} is scheduled at ${pickupTimeStr}. Tap to view.`,
        type: 'info',
        data: {
          job_id: job.id,
          scheduled_for: reminderTime.toISOString(),
          pickup_time: job.scheduled_pickup_time
        },
        read: false
      });

      console.log(`Reminder created for ${reminderTime.toISOString()}`);
    } catch (error) {
      console.error('Error creating pickup reminder:', error);
    }
  };

  const handleCourierAcceptJob = async () => {
    if (!courier || !job) return;

    const { data: existingAssignment } = await supabase
      .from('jobs')
      .select('assigned_courier_id, status')
      .eq('id', jobId)
      .single();

    if (existingAssignment?.assigned_courier_id) {
      addNotification('This job has already been accepted by another courier.', 'warning');
      setShowAcceptJobModal(false);
      fetchJobDetails();
      return;
    }

    setSubmittingCourierAction(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'assigned',
          assigned_courier_id: courier.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      setShowAcceptJobModal(false);
      addNotification('Job accepted successfully!', 'success');

      if (job.delivery_type === 'scheduled' && job.scheduled_pickup_time && courier && user) {
        await createPickupReminder(job, courier.user_id);
      }

      await fetchJobDetails();
    } catch (error) {
      console.error('Error accepting job:', error);
      if (error instanceof Error) {
        addNotification(`Failed to accept job: ${error.message}`, 'warning');
      } else {
        addNotification('Failed to accept job. Please try again.', 'warning');
      }
    } finally {
      setSubmittingCourierAction(false);
    }
  };

  const submitCourierCounterOffer = async (amount: number, message: string) => {
    if (!user || !courier) return;

    setSubmittingCourierAction(true);
    try {
      const { error } = await supabase
        .from('counter_offers')
        .insert({
          job_id: jobId,
          courier_id: courier.id,
          user_id: user.id,
          amount_ttd: amount,
          message: message,
          offered_by_role: 'courier',
          status: 'pending',
        });

      if (error) throw error;

      setShowCourierCounterOfferModal(false);
      fetchJobDetails();
      addNotification('Counter offer sent successfully!', 'success');
    } catch (error) {
      console.error('Error submitting counter offer:', error);
      addNotification('Failed to submit counter offer. Please try again.', 'warning');
    } finally {
      setSubmittingCourierAction(false);
    }
  };

  const submitCustomerCounterOffer = async (amount: number, message: string) => {
    if (!user || !selectedCourierForCounter) return;

    try {
      const offeredByRole = profile?.role === 'business' ? 'business' : 'customer';

      const { error } = await supabase
        .from('counter_offers')
        .insert({
          job_id: jobId,
          courier_id: selectedCourierForCounter.courierId,
          user_id: user.id,
          amount_ttd: amount,
          message: message,
          status: 'pending',
          offered_by_role: offeredByRole,
        });

      if (error) throw error;

      if (selectedCourierForCounter.offerId) {
        await supabase
          .from('counter_offers')
          .update({ status: 'countered' })
          .eq('id', selectedCourierForCounter.offerId);
      }

      setShowCustomerCounterOfferModal(false);
      setSelectedCourierForCounter(null);
      fetchJobDetails();
      addNotification('Counter offer sent successfully!', 'success');
    } catch (error) {
      console.error('Error submitting customer counter offer:', error);
      throw error;
    }
  };

  const handleMessageBidder = async (_courierId: string) => {
    if (!user) return;

    try {
      const conversationId = await getOrCreateJobConversation(jobId);
      setActiveConversationId(conversationId);
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      const errorMessage = error?.message || 'Unable to start conversation. Please try again.';
      addNotification(errorMessage, 'warning');
    }
  };

  const handleCancelJob = async () => {
    if (!job || !user) return;

    setCancelling(true);
    try {
      const driverEnroute = isDriverEnroute();
      const hasAssignedCourier = !!job.assigned_courier_id;

      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by_user_id: user.id,
          cancellation_fee_eligible: driverEnroute || hasAssignedCourier,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;

      setShowCancelModal(false);
      await fetchJobDetails();
    } catch (error) {
      console.error('Error cancelling job:', error);
      addNotification('Failed to cancel job. Please try again.', 'warning');
    } finally {
      setCancelling(false);
    }
  };

  const isRetailOwner = () => {
    if (!job || !user || !profile) return false;
    return (
      profile.role === 'business' &&
      profile.business_type === 'retail' &&
      job.customer_user_id === user.id
    );
  };

  const isJobOwner = () => {
    if (!job || !user) return false;
    return job.customer_user_id === user.id;
  };

  const canEditJob = () => {
    if (!isJobOwner() || !job) return false;
    return ['open', 'bidding'].includes(job.status);
  };

  const canCancelJob = () => {
    if (!isJobOwner() || !job) return false;
    return !['completed', 'cancelled'].includes(job.status);
  };

  const isDriverEnroute = () => {
    if (!job) return false;
    return ['on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit'].includes(job.status);
  };

  if (activeConversationId) {
    return (
      <div className="fixed inset-0 bg-white z-[60]">
        <ChatView
          conversationId={activeConversationId}
          onBack={() => setActiveConversationId(null)}
        />
      </div>
    );
  }

  const isActiveJob = job && ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'in_progress', 'returning'].includes(job.status);

  const isCourierViewingTheirJob = () => {
    if (!job || !user || !courier) return false;
    return job.assigned_courier_id === courier.id &&
           (profile?.role === 'courier' || (profile?.role === 'business' && profile?.business_type === 'haulage'));
  };

  const navigateToActiveJobs = () => {
    const basePath = profile?.role === 'business' && profile?.business_type === 'haulage'
      ? '/courier/jobs'
      : profile?.role === 'courier'
      ? '/courier/jobs'
      : '/';

    window.location.href = `${basePath}?tab=active`;
  };

  const renderDeliveryProgress = () => {
    if (!job) return null;

    const statuses = ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'completed'];
    const currentIndex = statuses.indexOf(job.status);

    if (currentIndex === -1) return null;

    const steps = [
      { label: 'Assigned', icon: CheckCircle2, description: 'Courier has been assigned to your delivery' },
      { label: 'En Route to Pickup', icon: Navigation, description: 'Courier is heading to pickup location' },
      { label: 'Arrived at Pickup', icon: Handshake, description: 'Driver has arrived and is waiting' },
      { label: 'Loading Cargo', icon: PackageCheck, description: 'Driver is loading your cargo' },
      { label: 'Cargo Collected', icon: Package, description: 'Your items have been picked up' },
      { label: 'In Transit', icon: Truck, description: 'Delivery is on the way to destination' },
      { label: 'Delivered', icon: MapPin, description: 'Items have been delivered' },
      { label: 'Completed', icon: CheckCircle2, description: 'Delivery confirmed and completed' },
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6">Delivery Progress</h2>

        <div className="space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index <= currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={index} className="relative">
                {index < steps.length - 1 && (
                  <div className={`absolute left-5 top-12 w-0.5 h-8 ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                    isCompleted
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-green-100 shadow-lg' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className={`font-semibold ${
                      isCompleted ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.label}
                      {isCurrent && (
                        <span className="ml-2 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </p>
                    <p className={`text-sm mt-0.5 ${
                      isCompleted ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Job not found</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-3 sm:px-4 overflow-x-hidden">
      <LiveTrackingModal
        isOpen={showLiveTracking}
        onClose={() => setShowLiveTracking(false)}
        jobId={jobId}
      />
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        {isCourierViewingTheirJob() && isActiveJob && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">This is your active job</p>
                  <p className="text-sm text-gray-600">Track and manage this delivery from your Active Jobs</p>
                </div>
              </div>
              <button
                onClick={navigateToActiveJobs}
                className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
              >
                <Truck className="w-4 h-4" />
                View Active Jobs
              </button>
            </div>
          </div>
        )}

        {detentionData && detentionData.arrivedAt && !isCourierViewingTheirJob() && job.status !== 'loading_cargo' && (
          <div className="mb-6">
            <DetentionTimer
              arrivedAt={detentionData.arrivedAt}
              vehicleType={detentionData.vehicleType}
              jobBasePrice={detentionData.jobBasePrice}
              detentionRecordId={detentionData.recordId}
              variant="customer"
              paused={job.status === 'loading_cargo'}
              pausedAt={(job as any).loading_started_at}
            />
          </div>
        )}

        {!isCompanyDriver && (job.detention_fee ?? 0) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Detention Fee Applied</span>
              </div>
              <span className="text-sm font-bold text-amber-900">${(job as any).detention_fee?.toFixed(0)} TTD</span>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              This fee was applied due to extended waiting time at pickup. It has been added to the job total.
            </p>
          </div>
        )}

        {job.status === 'returning' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-red-900">Delivery Returning to Base</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {(job as any).return_reason === 'customer_refused' && 'Reason: Customer Refused Item'}
                  {(job as any).return_reason === 'item_does_not_fit' && 'Reason: Item Does Not Fit'}
                  {(job as any).return_reason === 'wrong_address_unavailable' && 'Reason: Wrong Address / Customer Unavailable'}
                  {(job as any).return_reason === 'item_damaged' && 'Reason: Item Damaged'}
                </p>
              </div>
            </div>
            {(job as any).return_notes && (
              <p className="text-xs text-red-700 bg-red-100 rounded-lg p-2.5 mb-2">
                Driver note: {(job as any).return_notes}
              </p>
            )}
            {!isCompanyDriver && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-700 font-medium">Return Fee (50% of fare):</span>
                <span className="text-red-900 font-bold">TTD ${((job as any).return_fee || 0).toLocaleString()}</span>
              </div>
            )}
            {(job as any).original_dropoff_location_text && (
              <p className="text-[11px] text-red-600 mt-2">
                Original dropoff: {(job as any).original_dropoff_location_text}
              </p>
            )}
          </div>
        )}

        {!isCompanyDriver && (job as any).return_fee > 0 && job.status === 'completed' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-800">Return Fee Applied</span>
              </div>
              <span className="text-sm font-bold text-red-900">${(job as any).return_fee?.toFixed(0)} TTD</span>
            </div>
            <p className="text-xs text-red-700 mt-1">
              This fee was applied due to a failed delivery. The item was returned to the pickup location.
            </p>
          </div>
        )}

        {/* Live Tracking Map - Show for Customer/Retail when tracking is active */}
        {shouldShowTrackingCard(job, !isCourierViewingTheirJob()) && job.delivery_stops && job.delivery_stops.length > 0 && (
          <div className="mb-6">
            <LiveTrackingMap
              jobId={job.id}
              deliveryStops={job.delivery_stops}
              currentSelectedStopId={job.current_selected_stop_id}
              routeType={job.route_type}
            />
          </div>
        )}

        {(job as any).job_type === 'marketplace_safebuy' &&
          (job as any).marketplace_inspection_status === 'inspection_submitted' &&
          (profile?.role === 'customer' || profile?.role === 'business') && (
          <div
            onClick={() => setShowBuyerApproval(true)}
            className="mb-6 p-5 bg-gradient-to-r from-blue-600 to-sky-600 rounded-xl shadow-lg cursor-pointer hover:from-blue-700 hover:to-sky-700 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-lg">Inspection Photo Ready</p>
                <p className="text-sm text-blue-100 mt-0.5">Your driver took a photo of the item. Tap to review and approve.</p>
              </div>
            </div>
          </div>
        )}

        {/* Completed Delivery Summary - Show all delivery details FIRST for completed jobs */}
        {job.status === 'completed' && assignedCourier && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 sm:px-6 py-4">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                Delivery Completed
              </h2>
              <p className="text-sm text-green-100">All deliveries have been successfully completed</p>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Rate Delivery Card - Only show for job owner */}
              {user && job.customer_user_id === user.id && assignedCourier && (
                <RateDeliveryCard
                  jobId={job.id}
                  providerId={assignedCourier.user_id}
                  providerName={assignedCourier.profiles?.full_name || 'Courier'}
                  providerType="courier"
                  vehicleInfo={`${assignedCourier.vehicle_make || ''} ${assignedCourier.vehicle_model || ''}`.trim()}
                  raterUserId={user.id}
                  raterAccountType={profile?.business_type === 'retail' ? 'retail' : 'customer'}
                  onRatingSubmitted={() => {
                    addNotification('Rating submitted successfully', 'success');
                  }}
                  onNotification={addNotification}
                />
              )}

              {/* Courier Info */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-4 border-b">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  {assignedCourier.profiles?.avatar_url ? (
                    <img
                      src={assignedCourier.profiles.avatar_url}
                      alt="Courier"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <p className="text-sm text-gray-600 mb-1">Delivered by</p>
                  <p className="font-bold text-gray-900 text-lg">
                    {assignedCourier.profiles?.full_name || 'Courier'}
                  </p>
                  <div className="mt-1">
                    <ProviderReputation
                      ratingAverage={assignedCourier.profiles?.rating_average}
                      ratingCount={assignedCourier.profiles?.rating_count}
                      completedDeliveries={assignedCourier.profiles?.completed_deliveries_count}
                      size="sm"
                    />
                  </div>
                  {assignedCourier.profiles?.phone && (
                    <a
                      href={`tel:${assignedCourier.profiles.phone}`}
                      className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1 mt-1"
                    >
                      <Phone className="w-3 h-3" />
                      {assignedCourier.profiles.phone}
                    </a>
                  )}
                  <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-2 rounded-lg mt-2">
                    <Truck className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold">
                      {assignedCourier.vehicle_make} {assignedCourier.vehicle_model}
                      {assignedCourier.vehicle_plate && ` • ${assignedCourier.vehicle_plate}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Stops with Proof */}
              {job.delivery_stops && job.delivery_stops.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Delivery Details</h3>
                  {job.delivery_stops
                    .filter(stop => stop.stop_type === 'DROPOFF' && stop.status === 'COMPLETED')
                    .map((stop, idx) => {
                      const pod = Array.isArray(stop.pod_stops) ? stop.pod_stops[0] : stop.pod_stops;

                      // Debug logging
                      if (pod?.photo_urls) {
                        console.log(`📸 POD Photos for stop ${idx + 1}:`, pod.photo_urls);
                      }

                      return (
                        <div key={stop.id} className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 mb-1">{stop.location_text}</p>
                              {stop.completed_at && (
                                <p className="text-xs text-gray-600">
                                  Completed: {new Date(stop.completed_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>

                          {pod && (
                            <div className="mt-3 pt-3 border-t border-green-200">
                              {pod.recipient_name && (
                                <p className="text-sm mb-2">
                                  <span className="font-semibold text-gray-700">Received by:</span>{' '}
                                  <span className="text-gray-900">{pod.recipient_name}</span>
                                </p>
                              )}

                              {pod.notes && (
                                <p className="text-sm mb-3">
                                  <span className="font-semibold text-gray-700">Notes:</span>{' '}
                                  <span className="text-gray-600 italic">{pod.notes}</span>
                                </p>
                              )}

                              {/* Delivery Photos */}
                              {pod.photo_urls && pod.photo_urls.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-sm font-semibold text-gray-700 mb-2">Delivery Photos:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {pod.photo_urls.map((photoUrl: string, photoIdx: number) => {
                                      const imageUrl = photoUrl;

                                      return (
                                        <div key={photoIdx} className="relative group">
                                          <img
                                            src={imageUrl}
                                            alt={`Delivery proof ${photoIdx + 1}`}
                                            className="w-24 h-24 object-cover rounded-lg border-2 border-green-300 cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => setSelectedImage(imageUrl)}
                                          />
                                          <button
                                            onClick={() => setSelectedImage(imageUrl)}
                                            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg"
                                          >
                                            <ImageIcon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* E-Signature */}
                              {pod.signature_image_url && (
                                <div className="mt-3">
                                  <p className="text-sm font-semibold text-gray-700 mb-2">E-Signature:</p>
                                  <div
                                    className="inline-block bg-white border-2 border-green-300 rounded-lg p-2 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setSelectedImage(pod.signature_image_url)}
                                  >
                                    <img
                                      src={pod.signature_image_url}
                                      alt="E-Signature"
                                      className="h-20 max-w-[200px] object-contain"
                                    />
                                  </div>
                                  {pod.signed_by_name && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      Signed by: {pod.signed_by_name}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Cargo Items Delivered */}
              {job.cargo_items && job.cargo_items.filter(item => item.status === 'delivered').length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Items Delivered</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {job.cargo_items
                      .filter(item => item.status === 'delivered')
                      .map((item, idx) => {
                        let deliveryProofUrl = null;
                        if (item.delivery_proof_photo_url) {
                          if (item.delivery_proof_photo_url.startsWith('http://') || item.delivery_proof_photo_url.startsWith('https://')) {
                            deliveryProofUrl = item.delivery_proof_photo_url;
                          } else {
                            deliveryProofUrl = supabase.storage.from('delivery-proofs').getPublicUrl(item.delivery_proof_photo_url).data.publicUrl;
                          }
                        }

                        let deliverySignatureUrl = null;
                        if (item.delivery_signature_url) {
                          if (item.delivery_signature_url.startsWith('http://') || item.delivery_signature_url.startsWith('https://')) {
                            deliverySignatureUrl = item.delivery_signature_url;
                          } else {
                            deliverySignatureUrl = supabase.storage.from('delivery-proofs').getPublicUrl(item.delivery_signature_url).data.publicUrl;
                          }
                        }

                        return (
                          <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm">
                                  {item.cargo_category === 'other' ? item.cargo_category_custom : item.cargo_category}
                                </p>
                                <p className="text-xs text-gray-600 capitalize">{item.cargo_size_category}</p>
                                {item.cargo_size_category === 'large' && item.dimensions_length && item.dimensions_width && item.dimensions_height && (
                                  <p className="text-xs text-blue-600 mt-0.5">
                                    {Number(item.dimensions_length)}{item.dimensions_length_unit || item.dimensions_unit || 'ft'} x {Number(item.dimensions_width)}{item.dimensions_width_unit || item.dimensions_unit || 'in'} x {Number(item.dimensions_height)}{item.dimensions_height_unit || item.dimensions_unit || 'in'}
                                  </p>
                                )}
                                {item.delivered_to_name && (
                                  <p className="text-xs text-gray-600 mt-1">To: {item.delivered_to_name}</p>
                                )}
                              </div>
                              {item.cargo_photo_url && (
                                <img
                                  src={item.cargo_photo_url}
                                  alt="Cargo"
                                  className="w-12 h-12 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80"
                                  onClick={() => setSelectedImage(item.cargo_photo_url)}
                                />
                              )}
                            </div>
                            {(deliveryProofUrl || deliverySignatureUrl) && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs font-semibold text-gray-600 mb-2">Delivery Proof:</p>
                                <div className="flex flex-wrap gap-2">
                                  {deliveryProofUrl && (
                                    <img
                                      src={deliveryProofUrl}
                                      alt="Delivery photo"
                                      className="w-20 h-20 object-cover rounded-lg border-2 border-green-300 cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => setSelectedImage(deliveryProofUrl)}
                                    />
                                  )}
                                  {deliverySignatureUrl && (
                                    <div
                                      className="inline-block bg-white border-2 border-green-300 rounded-lg p-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => setSelectedImage(deliverySignatureUrl)}
                                    >
                                      <img
                                        src={deliverySignatureUrl}
                                        alt="E-Signature"
                                        className="h-16 max-w-[140px] object-contain"
                                      />
                                    </div>
                                  )}
                                </div>
                                {item.delivered_to_name && (
                                  <p className="text-xs text-gray-500 mt-1.5">Signed by: {item.delivered_to_name}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Job Details</h1>
              {(isRetailOwner() || (user && job.customer_user_id === user.id)) && (
                <div className="flex flex-wrap gap-2">
                  {(assignedCourier || job.assigned_company_id) && job.status !== 'cancelled' && job.status !== 'completed' && (
                    <button
                      onClick={() => {
                        const serviceProviderId = assignedCourier?.user_id || job.assigned_company_id;
                        if (serviceProviderId) {
                          handleMessageBidder(serviceProviderId);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Message Driver
                    </button>
                  )}
                  {canEditJob() ? (
                    <button
                      onClick={() => onEdit?.(jobId)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Job
                    </button>
                  ) : job.status !== 'cancelled' && job.status !== 'completed' && (
                    <button
                      disabled
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 text-sm font-semibold rounded-lg cursor-not-allowed"
                      title="This job can't be edited once a driver has accepted it."
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Job
                    </button>
                  )}
                  {canCancelJob() && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel Job
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                job.status === 'open' || job.status === 'bidding' ? 'bg-blue-100 text-blue-700' :
                job.status === 'assigned' || job.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                job.status === 'completed' ? 'bg-green-100 text-green-700' :
                job.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                job.status === 'returning' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {job.status === 'returning' ? 'RETURNING' : job.status.toUpperCase()}
              </span>
              {(() => {
                const jt = getJobTypeInfo((job as any).job_type);
                const IconMap = { Package, Bike, ShoppingBag, Trash2, ShoppingCart };
                const Icon = IconMap[jt.iconName];
                return (job as any).job_type && (job as any).job_type !== 'standard' ? (
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${jt.badgeBg} ${jt.badgeText} border ${jt.badgeBorder}`}>
                    <Icon className="w-3 h-3" />
                    {jt.label}
                  </span>
                ) : null;
              })()}
            </div>
          </div>

          {/* Show route and cargo information for all jobs */}
          {(() => {
            const route = buildRouteFromJob(job);

            return (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-blue-600" />
                      {route.isMultiStop ? 'Delivery Route' : 'Delivery Locations'}
                    </h3>

                    {route.isMultiStop ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-700">Route Summary</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-gray-600">Total Distance</p>
                              <p className="font-bold text-gray-900">{route.totalDistance.toFixed(1)} km</p>
                            </div>
                            {route.etaMinutes && (
                              <div>
                                <p className="text-gray-600">Estimated Time</p>
                                <p className="font-bold text-gray-900">{formatMinutesToHoursMinutes(route.etaMinutes)}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {route.pickupGroups.map((group, groupIdx) => (
                          <div key={group.pickup.id} className="space-y-2 pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border-2 border-green-600">
                              <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                P{groupIdx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-green-900 mb-0.5 uppercase tracking-wide">
                                  {group.pickup.label || `Pickup ${groupIdx + 1}`}
                                </p>
                                <p className="text-sm text-gray-900 font-medium">{group.pickup.address}</p>
                              </div>
                            </div>

                            {group.dropoffs.length > 0 ? (
                              <div className="ml-5 pl-4 border-l-2 border-gray-300 space-y-2">
                                <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-red-600" />
                                  Drop-off Stops for P{groupIdx + 1}
                                </div>
                                {group.dropoffs.map((dropoff, dropoffIdx) => (
                                  <div key={dropoff.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border-2 border-red-400">
                                    <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
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
                            ) : (
                              <div className="ml-5 pl-4 border-l-2 border-gray-300">
                                <p className="text-xs text-gray-500 italic">No drop-offs for this pickup yet</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center gap-2 text-gray-600 mb-1">
                            <MapPin className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium">Pickup</span>
                          </div>
                          <p className="text-gray-900 ml-6">{route.pickups[0]?.address}</p>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 text-gray-600 mb-1">
                            <MapPin className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium">Drop-off</span>
                          </div>
                          <p className="text-gray-900 ml-6">{route.dropoffs[0]?.address}</p>
                        </div>

                        <div className="pt-2 border-t">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600">Distance</p>
                              <p className="font-semibold text-gray-900">{route.totalDistance.toFixed(1)} km</p>
                            </div>
                            {route.etaMinutes && (
                              <div>
                                <p className="text-gray-600">Estimated Time</p>
                                <p className="font-semibold text-gray-900">{formatMinutesToHoursMinutes(route.etaMinutes)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {job.cargo_items && job.cargo_items.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Package className="w-5 h-5 text-blue-600" />
                          Cargo Information
                        </h3>
                        <div className="space-y-3">
                          {job.cargo_items.map((item, idx) => {
                            const hasDeliveryProof = item.status === 'delivered' && item.delivery_proof_photo_url;
                            let deliveryProofUrl = null;
                            if (hasDeliveryProof) {
                              if (item.delivery_proof_photo_url!.startsWith('http://') || item.delivery_proof_photo_url!.startsWith('https://')) {
                                deliveryProofUrl = item.delivery_proof_photo_url!;
                              } else {
                                deliveryProofUrl = supabase.storage.from('delivery-proofs').getPublicUrl(item.delivery_proof_photo_url!).data.publicUrl;
                              }
                            }

                            let stopLabel = '';
                            if (route.isMultiStop && item.dropoff_location_text) {
                              const dropoffIndex = route.dropoffs.findIndex(d =>
                                d.address === item.dropoff_location_text ||
                                (d.lat === item.dropoff_lat && d.lng === item.dropoff_lng)
                              );
                              if (dropoffIndex >= 0) {
                                stopLabel = route.dropoffs[dropoffIndex].label || `Stop ${dropoffIndex + 1}`;
                              }
                            }

                            return (
                              <div key={item.id} className={`p-4 rounded-lg border-2 ${
                                item.status === 'delivered' ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
                              }`}>
                                <div className="flex items-start gap-3">
                                  {item.cargo_photo_url && (
                                    <div className="flex-shrink-0">
                                      <img
                                        src={item.cargo_photo_url}
                                        alt={`Cargo item ${idx + 1}`}
                                        className="w-20 h-20 rounded-lg object-cover border-2 border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => setSelectedImage(item.cargo_photo_url)}
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <p className="font-bold text-gray-900 text-base">Item {idx + 1}</p>
                                        {item.status === 'delivered' && (
                                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                                            DELIVERED
                                          </span>
                                        )}
                                      </div>
                                      {item.cargo_photo_url && (
                                        <button
                                          onClick={() => setSelectedImage(item.cargo_photo_url)}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                                        >
                                          <ImageIcon className="w-3.5 h-3.5" />
                                          View Photo
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-3">
                                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold capitalize">
                                        {item.cargo_size_category}
                                      </span>
                                      <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold capitalize">
                                        {item.cargo_category === 'other' ? item.cargo_category_custom : item.cargo_category}
                                      </span>
                                      {item.cargo_weight_kg && (
                                        <span className="px-2.5 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-semibold">
                                          {Number(item.cargo_weight_kg) % 1 === 0 ? Math.round(item.cargo_weight_kg) : Number(item.cargo_weight_kg).toFixed(1)} kg
                                        </span>
                                      )}
                                    </div>

                                    {item.cargo_size_category === 'large' && (
                                      <div className="mb-3">
                                        {item.dimensions_length && item.dimensions_width && item.dimensions_height ? (
                                          <p className="text-sm text-gray-700">
                                            <span className="font-semibold text-gray-900">Dimensions:</span>{' '}
                                            {Number(item.dimensions_length)}{item.dimensions_length_unit || item.dimensions_unit || 'ft'} x {Number(item.dimensions_width)}{item.dimensions_width_unit || item.dimensions_unit || 'in'} x {Number(item.dimensions_height)}{item.dimensions_height_unit || item.dimensions_unit || 'in'}
                                          </p>
                                        ) : (
                                          <p className="text-sm text-amber-600">
                                            <span className="font-semibold">Dimensions:</span> Not provided
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {item.cargo_notes && (
                                      <div className="mb-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                                        <p className="text-xs text-gray-700">
                                          <span className="font-bold text-gray-900">Notes:</span> {item.cargo_notes}
                                        </p>
                                      </div>
                                    )}

                                    {item.dropoff_location_text && (
                                      <div className="mt-3 pt-3 border-t border-gray-300">
                                        {stopLabel && (
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                                              {stopLabel}
                                            </span>
                                          </div>
                                        )}
                                        <p className="text-sm text-gray-900 flex items-start gap-2 mb-2">
                                          <MapPin className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                          <span className="font-medium">{item.dropoff_location_text}</span>
                                        </p>
                                        {item.dropoff_contact_name && (
                                          <p className="text-sm text-gray-700 ml-6">
                                            <span className="font-semibold">Contact:</span> {item.dropoff_contact_name}
                                            {item.dropoff_contact_phone && <span className="text-gray-600"> • {item.dropoff_contact_phone}</span>}
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {item.status === 'delivered' && (() => {
                                      let sigUrl: string | null = null;
                                      if (item.delivery_signature_url) {
                                        if (item.delivery_signature_url.startsWith('http')) {
                                          sigUrl = item.delivery_signature_url;
                                        } else {
                                          sigUrl = supabase.storage.from('delivery-proofs').getPublicUrl(item.delivery_signature_url).data.publicUrl;
                                        }
                                      }
                                      return (
                                        <div className="mt-3 pt-3 border-t border-green-200">
                                          <div className="flex items-start gap-3">
                                            {deliveryProofUrl && (
                                              <div className="flex-shrink-0">
                                                <img
                                                  src={deliveryProofUrl}
                                                  alt="Delivery proof"
                                                  className="w-20 h-20 rounded-lg object-cover border-2 border-green-300 cursor-pointer hover:opacity-80 transition-opacity"
                                                  onClick={() => setSelectedImage(deliveryProofUrl)}
                                                />
                                                <button
                                                  onClick={() => setSelectedImage(deliveryProofUrl)}
                                                  className="text-xs text-green-700 hover:text-green-800 font-medium mt-1 flex items-center gap-1 justify-center w-full"
                                                >
                                                  <ImageIcon className="w-3 h-3" />
                                                  View Proof
                                                </button>
                                              </div>
                                            )}
                                            <div className="flex-1 space-y-1">
                                              <p className="text-xs font-semibold text-green-900">Delivery Completed</p>
                                              {item.delivered_to_name && (
                                                <p className="text-xs text-gray-700">
                                                  <span className="font-medium">Received by:</span> {item.delivered_to_name}
                                                </p>
                                              )}
                                              {item.delivered_at && (
                                                <p className="text-xs text-gray-600">
                                                  {new Date(item.delivered_at).toLocaleString()}
                                                </p>
                                              )}
                                              {item.delivery_notes_from_courier && (
                                                <p className="text-xs text-gray-600 italic">
                                                  Note: {item.delivery_notes_from_courier}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          {sigUrl && (
                                            <div className="mt-3">
                                              <p className="text-xs font-semibold text-gray-600 mb-1">E-Signature:</p>
                                              <div
                                                className="inline-block bg-white border-2 border-green-300 rounded-lg p-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => setSelectedImage(sigUrl)}
                                              >
                                                <img
                                                  src={sigUrl}
                                                  alt="E-Signature"
                                                  className="h-16 max-w-[180px] object-contain"
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Proof of Delivery Section */}
                    {job.proof_of_delivery_required && job.proof_of_delivery_required !== 'NONE' && (
                      <div className="pt-3 border-t">
                        <ProofOfDeliveryUpload
                          jobId={job.id}
                          podRequired={job.proof_of_delivery_required}
                          readOnly={profile?.role !== 'courier' && profile?.role !== 'admin'}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {isCompanyDriver ? null : (profile?.role === 'courier' || (profile?.role === 'business' && profile?.business_type === 'haulage')) ? (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm text-gray-600 mb-2">Earnings Breakdown</p>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Gross Job Value</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(job.customer_offer_ttd)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Platform Fee ({parseFloat((platformFeePercent * 100).toFixed(1))}%)</span>
                            <span className="font-semibold text-red-600">-{formatCurrency(calculateDriverFees(job.customer_offer_ttd, platformFeePercent).platformFee)}</span>
                          </div>
                          {(job as any).return_fee > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-orange-600">Return Fee (50% of fare)</span>
                              <span className="font-semibold text-orange-700">+{formatCurrency((job as any).return_fee)}</span>
                            </div>
                          )}
                          {(job.detention_fee ?? 0) > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-amber-600">Detention Fee</span>
                              <span className="font-semibold text-amber-700">+{formatCurrency(job.detention_fee)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t border-green-200">
                            <span className="text-sm font-bold text-gray-900">Your Net Payout</span>
                            <span className="text-xl font-bold text-green-700">{formatCurrency(
                              calculateDriverFees(job.customer_offer_ttd, platformFeePercent).netEarnings
                              + ((job as any).return_fee > 0 ? Number((job as any).return_fee) : 0)
                              + ((job.detention_fee ?? 0) > 0 ? Number(job.detention_fee) : 0)
                            )}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-gray-600 mb-2">Payment Summary</p>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Subtotal</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(job.customer_offer_ttd)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Platform Fee ({parseFloat((platformFeePercent * 100).toFixed(1))}%)</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(calculateCustomerFees(job.customer_offer_ttd, platformFeePercent).platformFee)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">VAT (12.5%)</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(calculateCustomerFees(job.customer_offer_ttd, platformFeePercent).vatAmount)}</span>
                          </div>
                          {(job as any).return_fee > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-orange-600">Return Fee</span>
                              <span className="font-semibold text-orange-700">+{formatCurrency((job as any).return_fee)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                            <span className="text-sm font-bold text-gray-900">Total</span>
                            <span className="text-xl font-bold text-blue-900">{formatCurrency(
                              calculateCustomerFees(job.customer_offer_ttd, platformFeePercent).customerTotal
                              + ((job as any).return_fee > 0 ? Number((job as any).return_fee) : 0)
                            )}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {(() => {
                      const jt = getJobTypeInfo((job as any).job_type);
                      const IconMap = { Package, Bike, ShoppingBag, Trash2, ShoppingCart };
                      const Icon = IconMap[jt.iconName];
                      const jobType = (job as any).job_type || 'standard';
                      return (
                        <div className={`p-4 rounded-lg border-2 ${jt.badgeBorder} ${jt.badgeBg}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-5 h-5 ${jt.badgeText}`} />
                            <h4 className={`text-sm font-bold ${jt.badgeText}`}>{jt.label}</h4>
                          </div>

                          {jobType === 'marketplace_safebuy' && (
                            <div className="space-y-3 mt-3">
                              {(job as any).marketplace_seller_contact && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                  <span className="text-gray-600">Seller:</span>
                                  <span className="font-semibold text-gray-900">{(job as any).marketplace_seller_contact}</span>
                                </div>
                              )}
                              {(job as any).marketplace_listing_url && (
                                <div className="flex items-center gap-2 text-sm min-w-0">
                                  <ExternalLink className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                  <span className="text-gray-600 flex-shrink-0">Listing:</span>
                                  <a href={(job as any).marketplace_listing_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline truncate min-w-0">
                                    {(job as any).marketplace_listing_url}
                                  </a>
                                </div>
                              )}
                              {(job as any).marketplace_payment_status && (
                                <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                                  (job as any).marketplace_payment_status === 'already_paid'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {(job as any).marketplace_payment_status === 'already_paid'
                                    ? 'Already paid seller'
                                    : 'Pay after inspection approval'}
                                </div>
                              )}
                              {!isCompanyDriver && (job as any).marketplace_max_budget > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                  <DollarSign className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                  <span className="text-gray-600">Max Budget:</span>
                                  <span className="font-semibold text-gray-900">TTD ${(job as any).marketplace_max_budget}</span>
                                </div>
                              )}
                              {(job as any).marketplace_inspection_instructions && (
                                <div className="p-3 bg-blue-100 rounded-lg">
                                  <p className="text-xs font-bold text-blue-900 mb-1">Inspection Instructions</p>
                                  <p className="text-xs text-blue-800 whitespace-pre-line">{(job as any).marketplace_inspection_instructions}</p>
                                </div>
                              )}
                              {(job as any).marketplace_item_screenshot_url && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-1">Item Screenshot</p>
                                  <img
                                    src={(job as any).marketplace_item_screenshot_url}
                                    alt="Item from listing"
                                    className="w-full h-40 object-cover rounded-lg border border-gray-200 cursor-pointer"
                                    onClick={() => setSelectedImage((job as any).marketplace_item_screenshot_url)}
                                  />
                                </div>
                              )}
                              {(() => {
                                const inspStatus = (job as any).marketplace_inspection_status;
                                const isCustomerView = profile?.role === 'customer' || profile?.role === 'business';
                                if (!inspStatus || inspStatus === 'pending_inspection') {
                                  return (
                                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>Awaiting driver inspection at seller's location</span>
                                    </div>
                                  );
                                }
                                if (inspStatus === 'inspection_submitted' && isCustomerView) {
                                  return (
                                    <button
                                      onClick={() => setShowBuyerApproval(true)}
                                      className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 animate-pulse active:scale-[0.98]"
                                    >
                                      <Camera className="w-4 h-4" />
                                      Review Inspection Photo
                                    </button>
                                  );
                                }
                                if (inspStatus === 'buyer_approved') {
                                  return (
                                    <div className="flex items-center gap-2 text-xs text-green-800 bg-green-50 rounded-lg p-2 border border-green-200">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                      <span className="font-semibold">Item approved -- driver is collecting</span>
                                    </div>
                                  );
                                }
                                if (inspStatus === 'buyer_rejected') {
                                  return (
                                    <div className="flex items-center gap-2 text-xs text-red-800 bg-red-50 rounded-lg p-2 border border-red-200">
                                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                                      <span className="font-semibold">Item rejected -- not collected</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}

                          {jobType === 'errand_runner' && (
                            <div className="space-y-2 mt-3">
                              {(job as any).errand_store_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Store className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                                  <span className="text-gray-600">Store:</span>
                                  <span className="font-semibold text-gray-900">{(job as any).errand_store_name}</span>
                                </div>
                              )}
                              {(job as any).errand_item_list && (
                                <div className="text-sm mt-1">
                                  <p className="text-gray-600 font-medium mb-1 flex items-center gap-1">
                                    <Package className="w-3.5 h-3.5 text-rose-600" />
                                    Shopping List:
                                  </p>
                                  <p className="text-gray-900 bg-white rounded p-2 border border-rose-200 whitespace-pre-wrap text-xs">{(job as any).errand_item_list}</p>
                                </div>
                              )}
                              {!isCompanyDriver && (job as any).errand_estimated_item_cost > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                  <DollarSign className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                                  <span className="text-gray-600">Estimated Item Cost:</span>
                                  <span className="font-semibold text-gray-900">TTD ${(job as any).errand_estimated_item_cost}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {jobType === 'junk_removal' && (
                            <div className="space-y-2 mt-3">
                              {(job as any).junk_disposal_type && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Recycle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                  <span className="text-gray-600">Disposal:</span>
                                  <span className="font-semibold text-gray-900 capitalize">{(job as any).junk_disposal_type}</span>
                                </div>
                              )}
                              {(job as any).junk_tipping_fee_included && (
                                <p className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  Tipping/disposal fee included in price
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-600" />
                        Delivery Requirements
                      </h4>

                      <div className="space-y-3 text-sm">
                        {job.delivery_type === 'scheduled' && job.scheduled_pickup_time ? (
                          <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-300">
                            <p className="text-xs font-bold text-blue-900 mb-1 uppercase tracking-wide">Scheduled Pickup</p>
                            <p className="text-lg font-bold text-blue-900">
                              {new Date(job.scheduled_pickup_time).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                            <p className="text-base font-semibold text-blue-800">
                              {new Date(job.scheduled_pickup_time).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </p>
                            <p className="text-xs text-blue-700 mt-1">Trinidad & Tobago (UTC-04:00)</p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Pickup Window</span>
                            <span className="font-semibold text-gray-900">
                              {job.urgency_hours} hours {job.delivery_type === 'asap' && <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full ml-2">ASAP</span>}
                            </span>
                          </div>
                        )}

                        {job.proof_of_delivery_required && job.proof_of_delivery_required !== 'NONE' && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Proof of Delivery</span>
                            <span className={`font-semibold ${requiresESignature(job.proof_of_delivery_required) ? 'text-blue-600' : 'text-gray-900'}`}>
                              {formatProofOfDelivery(job.proof_of_delivery_required)}
                            </span>
                          </div>
                        )}

                        {requiresESignature(job.proof_of_delivery_required) && (
                          <div className="p-2 bg-blue-50 rounded border border-blue-200">
                            <p className="text-xs text-blue-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              E-signature will be collected at delivery
                            </p>
                          </div>
                        )}

                        {(job as any).cash_to_return && (
                          <div className="p-3 bg-amber-50 rounded-lg border-2 border-amber-300">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-amber-900">Cash to be Returned</span>
                              {!isCompanyDriver && (
                                <span className="text-lg font-bold text-amber-700">TTD ${((job as any).cash_to_return_amount || 0).toLocaleString()}</span>
                              )}
                            </div>
                            <p className="text-xs text-amber-700">
                              Driver will collect this amount from the recipient and return it to the sender.
                            </p>
                            {(job as any).cash_collection_status && (job as any).cash_collection_status !== 'none' && (
                              <div className={`mt-2 px-2 py-1 rounded text-xs font-semibold inline-block ${
                                (job as any).cash_collection_status === 'returned'
                                  ? 'bg-green-100 text-green-800'
                                  : (job as any).cash_collection_status === 'collected'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {(job as any).cash_collection_status === 'returned' ? 'Cash Returned'
                                  : (job as any).cash_collection_status === 'collected' ? 'Cash Collected by Driver'
                                  : 'Pending Collection'}
                              </div>
                            )}
                          </div>
                        )}

                        {((job as any).declared_cargo_value > 0 || (job as any).cargo_insurance_enabled || (job as any).is_high_value) && (
                          <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                            <p className="text-xs font-bold text-blue-900 mb-2 uppercase tracking-wide">Cargo Value & Insurance</p>
                            <div className="flex flex-wrap gap-2">
                              {!isCompanyDriver && (job as any).declared_cargo_value > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                  <DollarSign className="w-3 h-3" />
                                  Declared: TTD ${((job as any).declared_cargo_value || 0).toLocaleString()}
                                </span>
                              )}
                              {(job as any).cargo_insurance_enabled && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                                  <ShieldCheck className="w-3 h-3" />
                                  {isCompanyDriver ? 'Insured' : `Insured (+TTD ${((job as any).cargo_insurance_fee || 0).toFixed(2)})`}
                                </span>
                              )}
                              {(job as any).is_high_value && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-800 rounded-full text-xs font-bold border border-sky-300">
                                  <Gem className="w-3 h-3" />
                                  High Value Shipment
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {(job.is_fragile || job.needs_cover || job.requires_heavy_lift || job.has_security_gate) && (
                          <div className="pt-3 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Special Requirements</p>
                            <div className="space-y-1">
                              {job.is_fragile && (
                                <p className="text-xs text-gray-600 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                  Handle with care (fragile)
                                </p>
                              )}
                              {job.needs_cover && (
                                <p className="text-xs text-gray-600 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  Weather protection required
                                </p>
                              )}
                              {job.requires_heavy_lift && (
                                <p className="text-xs text-gray-600 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                  Heavy lifting required
                                </p>
                              )}
                              {job.has_security_gate && (
                                <p className="text-xs text-gray-600 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                  Security gate access needed
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {job.special_requirements_notes && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Special Notes</p>
                        <p className="text-sm text-gray-900">{job.special_requirements_notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {job.cargo_notes && (
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-sm font-medium text-gray-700 mb-2">Additional Notes</p>
                    <p className="text-gray-600">{job.cargo_notes}</p>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Only show delivery progress for non-completed jobs */}
        {job.status !== 'completed' && renderDeliveryProgress()}

        {assignedCourier && job.status !== 'completed' && !isCompanyDriver && !isCourierViewingTheirJob() && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-moveme-blue-600 to-moveme-blue-700 px-4 sm:px-6 py-4">
              <h2 className="text-lg sm:text-xl font-bold text-white">Your Courier</h2>
              <p className="text-sm text-moveme-blue-100">Delivery is being handled by a verified courier</p>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-moveme-blue-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  {assignedCourier.profiles?.avatar_url ? (
                    <img
                      src={assignedCourier.profiles.avatar_url}
                      alt="Courier"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <p className="font-bold text-gray-900 text-lg sm:text-xl mb-1">
                    {assignedCourier.profiles?.full_name || 'Courier'}
                  </p>
                  <div className="mb-2">
                    <ProviderReputation
                      ratingAverage={assignedCourier.profiles?.rating_average}
                      ratingCount={assignedCourier.profiles?.rating_count}
                      completedDeliveries={assignedCourier.profiles?.completed_deliveries_count}
                      size="sm"
                    />
                  </div>
                  {assignedCourier.profiles?.phone && (
                    <a
                      href={`tel:${assignedCourier.profiles.phone}`}
                      className="flex items-center justify-center sm:justify-start gap-2 text-moveme-blue-600 hover:text-moveme-blue-700 font-medium mb-2 group"
                    >
                      <Phone className="w-4 h-4" />
                      <span className="group-hover:underline">{assignedCourier.profiles.phone}</span>
                    </a>
                  )}
                  <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                    <Truck className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <div className="text-sm min-w-0">
                      <span className="font-semibold break-words">
                        {assignedCourier.vehicle_make} {assignedCourier.vehicle_model}
                      </span>
                      {assignedCourier.vehicle_type && (
                        <span className="text-gray-600"> • {assignedCourier.vehicle_type}</span>
                      )}
                      {assignedCourier.vehicle_plate && (
                        <span className="block text-xs text-gray-600 mt-0.5">
                          Plate: <span className="font-semibold">{assignedCourier.vehicle_plate}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleMessageBidder(assignedCourier.user_id)}
                  className="py-3 px-4 bg-moveme-blue-600 text-white rounded-xl font-semibold hover:bg-moveme-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Message
                </button>
                {(['in_transit', 'cargo_collected', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo'].includes(job.status)) && (
                  <button
                    onClick={() => setShowLiveTracking(true)}
                    className="py-3 px-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-5 h-5" />
                    Track Live
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {job.pricing_type === 'bid' &&
         (profile?.role === 'customer' || profile?.role === 'business') &&
         job.customer_user_id === user?.id && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Bids {bids.length > 0 && `(${bids.length})`}
            </h2>

            {bids.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No bids yet. Couriers will see your job and submit bids.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bids.map((bid) => (
                  <div key={bid.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-blue-300 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-moveme-blue-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {bid.couriers?.profiles?.avatar_url ? (
                            <img
                              src={bid.couriers.profiles.avatar_url}
                              alt="Courier"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900 truncate">
                              {bid.couriers?.profiles?.full_name || 'Courier'}
                            </p>
                            <button
                              onClick={() => handleMessageBidder(bid.couriers.user_id)}
                              className="p-1.5 text-moveme-blue-600 hover:bg-moveme-blue-50 rounded-full transition-colors flex-shrink-0"
                              title="Message bidder"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </div>
                          <ProviderReputation
                            ratingAverage={bid.couriers?.profiles?.rating_average}
                            ratingCount={bid.couriers?.profiles?.rating_count}
                            completedDeliveries={bid.couriers?.profiles?.completed_deliveries_count}
                            size="sm"
                          />
                          <p className="text-sm text-gray-600 truncate">
                            {bid.couriers?.vehicle_make} {bid.couriers?.vehicle_model}
                            {bid.couriers?.vehicle_type && ` (${bid.couriers?.vehicle_type})`}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex sm:block items-center gap-3 pl-13 sm:pl-0">
                        <p className="text-xl sm:text-2xl font-bold text-green-600">TTD ${bid.amount_ttd}</p>
                        {bid.eta_minutes && (
                          <p className="text-sm text-gray-600">ETA: {formatMinutesToHoursMinutes(bid.eta_minutes)}</p>
                        )}
                      </div>
                    </div>

                    {bid.message && (
                      <p className="text-sm text-gray-700 mb-3 p-3 bg-gray-50 rounded">
                        {bid.message}
                      </p>
                    )}

                    {job.status === 'open' || job.status === 'bidding' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptBid(bid.id, bid.courier_id)}
                          disabled={accepting === bid.id}
                          className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {accepting === bid.id ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Accepting...
                            </>
                          ) : (
                            <>
                              <Check className="w-5 h-5" />
                              Accept
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleCustomerCounterOffer(bid.courier_id, null, bid.amount_ttd)}
                          className="flex-1 py-2 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                          <DollarSign className="w-5 h-5" />
                          Counter Bid
                        </button>
                      </div>
                    ) : bid.status === 'accepted' ? (
                      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-green-100 text-green-700 rounded-lg font-semibold">
                        <Check className="w-5 h-5" />
                        Accepted
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isCompanyDriver &&
         (profile?.role === 'courier' || (profile?.role === 'business' && profile?.business_type === 'haulage')) &&
         job.customer_user_id !== user?.id &&
         (job.status === 'open' || job.status === 'bidding') &&
         !job.assigned_courier_id &&
         courier && (
          <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl shadow-sm p-4 sm:p-6 mt-6 border-2 border-blue-200">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              Take Action on This Job
            </h2>

            {job.pricing_type === 'bid' ? (
              <div>
                <p className="text-gray-700 mb-4">
                  This is an auction-style job. Submit your bid to compete for this delivery.
                </p>
                {(() => {
                  const myBid = bids.find(bid => bid.courier_id === courier.id);
                  if (myBid) {
                    return (
                      <div className="mb-4 p-4 bg-blue-100 border-2 border-blue-300 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-blue-900">Your Current Bid</p>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            myBid.status === 'accepted' ? 'bg-green-200 text-green-800' :
                            myBid.status === 'rejected' ? 'bg-red-200 text-red-800' :
                            'bg-yellow-200 text-yellow-800'
                          }`}>
                            {myBid.status === 'accepted' ? 'Accepted' :
                             myBid.status === 'rejected' ? 'Declined' :
                             'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-blue-900">TTD ${myBid.amount_ttd}</p>
                            {myBid.eta_minutes && (
                              <p className="text-sm text-blue-700">ETA: {formatMinutesToHoursMinutes(myBid.eta_minutes)}</p>
                            )}
                          </div>
                          {myBid.status === 'active' && (
                            <button
                              onClick={() => {
                                setCourierBidAmount(myBid.amount_ttd.toString());
                                setCourierBidEta(myBid.eta_minutes?.toString() || '');
                                setCourierBidMessage(myBid.message || '');
                                setShowCourierBidModal(true);
                              }}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all"
                            >
                              Update Bid
                            </button>
                          )}
                        </div>
                        {myBid.message && (
                          <p className="text-sm text-blue-800 mt-2 pt-2 border-t border-blue-300">
                            {myBid.message}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
                <button
                  onClick={() => {
                    const myBid = bids.find(bid => bid.courier_id === courier.id);
                    if (!myBid) {
                      setCourierBidAmount(job.price_ttd?.toString() || '');
                    }
                    setShowCourierBidModal(true);
                  }}
                  className="w-full py-3 px-6 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-5 h-5" />
                  {bids.find(bid => bid.courier_id === courier.id) ? 'Update Bid' : 'Place Bid'}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-700 mb-4">
                  This is a fixed-price job listed at <span className="font-bold text-green-600">{formatCurrency(job.customer_offer_ttd || job.price_ttd || 0)}</span>.
                </p>
                <div>
                  <button
                    onClick={() => setShowAcceptJobModal(true)}
                    className="w-full py-3 px-6 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    Accept Job
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {counterOffers.length > 0 && (
          <div ref={counterOffersRef} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mt-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
              Counter Offers ({counterOffers.length})
            </h2>

            <div className="space-y-4">
              {counterOffers.map((offer) => (
                <div
                  key={offer.id}
                  className={`border rounded-lg p-3 sm:p-4 transition-all ${
                    highlightedOfferId === offer.id
                      ? 'border-purple-500 bg-purple-50 shadow-lg ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                        {offer.couriers?.profiles?.avatar_url ? (
                          <img
                            src={offer.couriers.profiles.avatar_url}
                            alt="Courier"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900 truncate">
                            {offer.offered_by_role === 'courier'
                              ? (offer.couriers?.profiles?.full_name || 'Courier')
                              : (job?.customer_user_id === user?.id ? 'You' : (offer.offered_by_role === 'business' ? 'Business' : 'Customer'))
                            }
                          </p>
                          {offer.offered_by_role === 'courier' && (
                            <button
                              onClick={() => handleMessageBidder(offer.couriers.user_id)}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-full transition-colors flex-shrink-0"
                              title="Message courier"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {offer.offered_by_role === 'courier' && (
                          <ProviderReputation
                            ratingAverage={offer.couriers?.profiles?.rating_average}
                            ratingCount={offer.couriers?.profiles?.rating_count}
                            completedDeliveries={offer.couriers?.profiles?.completed_deliveries_count}
                            size="sm"
                          />
                        )}
                        <p className="text-sm text-gray-600 truncate">
                          {offer.offered_by_role === 'courier'
                            ? `${offer.couriers?.vehicle_make} ${offer.couriers?.vehicle_model}${offer.couriers?.vehicle_type ? ` (${offer.couriers?.vehicle_type})` : ''}`
                            : `Counter Offer from ${offer.offered_by_role}`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right pl-13 sm:pl-0">
                      <p className="text-xl sm:text-2xl font-bold text-purple-600">TTD ${offer.amount_ttd}</p>
                      <p className="text-xs text-gray-500 mt-1">Counter Offer</p>
                    </div>
                  </div>

                  {offer.message && (
                    <div className="mb-3 p-3 bg-purple-50 rounded border border-purple-100">
                      <p className="text-sm font-medium text-gray-700 mb-1">Message:</p>
                      <p className="text-sm text-gray-700">{offer.message}</p>
                    </div>
                  )}

                  {offer.status === 'countered' ? (
                    <div className="flex items-center justify-center gap-2 py-2 px-4 bg-blue-100 text-blue-700 rounded-lg font-semibold">
                      <Clock className="w-5 h-5" />
                      Pending Counter Offer
                    </div>
                  ) : offer.status === 'accepted' ? (
                    <div className="flex items-center justify-center gap-2 py-2 px-4 bg-green-100 text-green-700 rounded-lg font-semibold">
                      <Check className="w-5 h-5" />
                      Accepted
                    </div>
                  ) : job.status === 'open' || job.status === 'bidding' ? (
                    offer.user_id === user?.id ? (
                      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-semibold">
                        <Clock className="w-5 h-5" />
                        Awaiting Response
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          onClick={() => acceptCounterOffer(offer.id, offer.courier_id, offer.amount_ttd)}
                          disabled={acceptingOffer === offer.id}
                          className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {acceptingOffer === offer.id ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Accepting...
                            </>
                          ) : (
                            <>
                              <Check className="w-5 h-5" />
                              Accept Offer
                            </>
                          )}
                        </button>
                        {job.pricing_type === 'bid' && (
                          <button
                            onClick={() => handleCustomerCounterOffer(offer.courier_id, offer.id, offer.amount_ttd)}
                            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                          >
                            <DollarSign className="w-5 h-5" />
                            Counter Offer
                          </button>
                        )}
                        <button
                          onClick={() => rejectCounterOffer(offer.id)}
                          disabled={rejectingOffer === offer.id}
                          className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {rejectingOffer === offer.id ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Declining...
                            </>
                          ) : (
                            <>
                              <XCircle className="w-5 h-5" />
                              Decline
                            </>
                          )}
                        </button>
                      </div>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {showCancelModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Cancel this job?</h2>
                </div>

                <div className="mb-6">
                  {!job.assigned_courier_id ? (
                    <p className="text-gray-700">
                      This will remove the job from the marketplace and notify any bidders.
                    </p>
                  ) : isDriverEnroute() ? (
                    <div className="space-y-2">
                      <p className="text-gray-700 font-medium">
                        A driver is currently on the way to complete this delivery.
                      </p>
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>
                            <strong>Note:</strong> A cancellation fee may apply in the future when cancelling after a driver has started the delivery.
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-gray-700">
                        A driver has accepted this job. Cancelling now will notify them of the cancellation.
                      </p>
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>
                            <strong>Note:</strong> A cancellation fee may apply in the future.
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    disabled={cancelling}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Keep Job
                  </button>
                  <button
                    onClick={handleCancelJob}
                    disabled={cancelling}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cancelling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      'Cancel Job'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <CounterOfferModal
          isOpen={showCustomerCounterOfferModal}
          jobPrice={selectedCourierForCounter?.currentAmount || job?.price_ttd || 0}
          priceLabel={selectedCourierForCounter?.offerId === null ? "Courier's Bid Amount" : "Current Offer Amount"}
          description={selectedCourierForCounter?.offerId === null
            ? 'Submit a counter bid to negotiate the price. The courier will be notified of your offer.'
            : 'Submit a counter offer. The courier will be notified of your new price.'}
          onClose={() => {
            setShowCustomerCounterOfferModal(false);
            setSelectedCourierForCounter(null);
          }}
          onSubmit={submitCustomerCounterOffer}
        />

        <CounterOfferModal
          isOpen={showCourierCounterOfferModal}
          jobPrice={job?.customer_offer_ttd || job?.price_ttd || 0}
          onClose={() => setShowCourierCounterOfferModal(false)}
          onSubmit={submitCourierCounterOffer}
        />

        {showCourierBidModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    {bids.find(bid => bid.courier_id === courier?.id) ? 'Update Your Bid' : 'Place Your Bid'}
                  </h2>
                  <button
                    onClick={() => setShowCourierBidModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Bid Amount (TTD) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={courierBidAmount}
                      onChange={(e) => setCourierBidAmount(e.target.value)}
                      placeholder="Enter your bid"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Starting bid: TTD ${job?.price_ttd || 0}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Time
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={courierBidEtaHours}
                            onChange={(e) => setCourierBidEtaHours(e.target.value)}
                            placeholder="0"
                            className="w-full px-4 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">hours</span>
                        </div>
                      </div>
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={courierBidEtaMinutes}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (e.target.value === '' || (val >= 0 && val <= 59)) {
                                setCourierBidEtaMinutes(e.target.value);
                              }
                            }}
                            placeholder="0"
                            className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">min</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message (Optional)
                    </label>
                    <textarea
                      value={courierBidMessage}
                      onChange={(e) => setCourierBidMessage(e.target.value)}
                      placeholder="Add a message to your bid"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCourierBidModal(false)}
                    disabled={submittingCourierAction}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCourierPlaceBid}
                    disabled={submittingCourierAction}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submittingCourierAction ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      bids.find(bid => bid.courier_id === courier?.id) ? 'Update Bid' : 'Place Bid'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <AcceptJobModal
          isOpen={showAcceptJobModal}
          job={job}
          onClose={() => setShowAcceptJobModal(false)}
          onConfirm={handleCourierAcceptJob}
          loading={submittingCourierAction}
        />

        {selectedImage && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
            <div className="relative max-w-4xl max-h-full">
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={selectedImage}
                alt="Cargo item"
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            </div>
          </div>
        )}

        {notifications.map(notification => (
          <NotificationToast
            key={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={() => removeNotification(notification.id)}
          />
        ))}

        {showBuyerApproval && job && (job as any).marketplace_inspection_photo_url && (
          <MarketplaceBuyerApproval
            jobId={job.id}
            inspectionPhotoUrl={(job as any).marketplace_inspection_photo_url}
            inspectionInstructions={(job as any).marketplace_inspection_instructions || null}
            onClose={() => setShowBuyerApproval(false)}
            onStatusUpdate={() => {
              fetchJobDetails();
              setShowBuyerApproval(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
