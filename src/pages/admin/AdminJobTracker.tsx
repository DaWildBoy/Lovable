import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, MapPin, Package, Loader2, Truck, Building2, Calendar,
  CheckCircle2, Navigation, Clock, Hash, Copy, DollarSign,
  User, Phone, Camera, FileSignature, CircleDot, ArrowRight,
  ExternalLink, AlertCircle, Radio, Eye,
} from 'lucide-react';
import { LiveTrackingMap } from '../../components/LiveTrackingMap';

interface DeliveryStop {
  id: string;
  stop_index: number;
  stop_type: 'PICKUP' | 'DROPOFF';
  location_text: string;
  location_lat: number | null;
  location_lng: number | null;
  status: 'NOT_STARTED' | 'ENROUTE' | 'ARRIVED' | 'COMPLETED';
  contact_name: string | null;
  contact_phone: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  pod_stops: PodStop[] | PodStop | null;
}

interface PodStop {
  id: string;
  required_type: string;
  status: string;
  photo_urls: string[] | null;
  signature_image_url: string | null;
  signed_by_name: string | null;
  recipient_name: string | null;
  notes: string | null;
  completed_at: string | null;
}

interface CargoItem {
  id: string;
  cargo_category: string | null;
  cargo_category_custom: string | null;
  cargo_size_category: string | null;
  cargo_photo_url: string | null;
  status: string | null;
  delivered_to_name: string | null;
  delivered_at: string | null;
  delivery_proof_photo_url: string | null;
  delivery_signature_url: string | null;
  delivery_notes_from_courier: string | null;
}

interface DriverLocation {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  updated_at: string;
}

interface FullJob {
  id: string;
  job_reference_id: string | null;
  status: string;
  customer_user_id: string;
  assigned_courier_id: string | null;
  assigned_company_id: string | null;
  pickup_location_text: string;
  dropoff_location_text: string;
  cargo_category: string | null;
  customer_offer_ttd: number | null;
  total_price: number | null;
  platform_fee: number | null;
  courier_earnings: number | null;
  created_at: string | null;
  delivery_type: string | null;
  is_multi_stop: boolean | null;
  assigned_company_name: string | null;
  assigned_driver_name: string | null;
  route_type: 'FIXED' | 'FLEXIBLE' | null;
  current_selected_stop_id: string | null;
  proof_of_delivery_required: string | null;
  special_requirements: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-warning-50 text-warning-700',
  draft: 'bg-warning-50 text-warning-700',
  bidding: 'bg-warning-50 text-warning-700',
  assigned: 'bg-moveme-blue-50 text-moveme-blue-700',
  on_way_to_pickup: 'bg-moveme-blue-50 text-moveme-blue-700',
  cargo_collected: 'bg-moveme-teal-50 text-moveme-teal-700',
  in_transit: 'bg-moveme-teal-50 text-moveme-teal-700',
  in_progress: 'bg-moveme-teal-50 text-moveme-teal-700',
  delivered: 'bg-success-50 text-success-700',
  completed: 'bg-success-50 text-success-700',
  cancelled: 'bg-error-50 text-error-700',
};

const STOP_STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  NOT_STARTED: { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-300' },
  ENROUTE: { bg: 'bg-moveme-blue-50', text: 'text-moveme-blue-700', dot: 'bg-moveme-blue-500' },
  ARRIVED: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' },
  COMPLETED: { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
};

function ttd(val: number | null | undefined) {
  return val != null ? `TT$${Number(val).toLocaleString('en-TT', { minimumFractionDigits: 2 })}` : '--';
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const PROGRESS_STEPS = [
  { key: 'assigned', label: 'Assigned', icon: CheckCircle2 },
  { key: 'on_way_to_pickup', label: 'En Route to Pickup', icon: Navigation },
  { key: 'cargo_collected', label: 'Cargo Collected', icon: Package },
  { key: 'in_transit', label: 'In Transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: MapPin },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
];

export function AdminJobTracker({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [job, setJob] = useState<FullJob | null>(null);
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [cargo, setCargo] = useState<CargoItem[]>([]);
  const [driverLoc, setDriverLoc] = useState<DriverLocation | null>(null);
  const [customerName, setCustomerName] = useState('Unknown');
  const [courierProfile, setCourierProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel(`admin-job-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` }, () => fetchJob())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_stops', filter: `job_id=eq.${jobId}` }, () => fetchStops())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_driver_location_current', filter: `job_id=eq.${jobId}` }, (payload) => {
        if (payload.new && typeof payload.new === 'object' && 'lat' in payload.new) {
          setDriverLoc(payload.new as DriverLocation);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchJob(), fetchStops(), fetchCargo(), fetchDriverLocation()]);
    setLoading(false);
  };

  const fetchJob = async () => {
    const { data } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
    if (!data) return;
    setJob(data as FullJob);
    const { data: cp } = await supabase.from('profiles').select('full_name, phone').eq('id', data.customer_user_id).maybeSingle();
    if (cp) setCustomerName(cp.full_name || 'Unknown');
    if (data.assigned_courier_id) {
      const { data: courier } = await supabase
        .from('couriers')
        .select('user_id, vehicle_type, vehicle_make, vehicle_model, vehicle_plate')
        .eq('id', data.assigned_courier_id)
        .maybeSingle();
      if (courier) {
        const { data: profile } = await supabase.from('profiles').select('full_name, phone, avatar_url, rating_average, rating_count, completed_deliveries_count').eq('id', courier.user_id).maybeSingle();
        setCourierProfile({ ...courier, profile });
      }
    }
  };

  const fetchStops = async () => {
    const { data } = await supabase
      .from('delivery_stops')
      .select('*, pod_stops(*)')
      .eq('job_id', jobId)
      .order('stop_index', { ascending: true });
    if (data) setStops(data as DeliveryStop[]);
  };

  const fetchCargo = async () => {
    const { data } = await supabase.from('cargo_items').select('*').eq('job_id', jobId);
    if (data) setCargo(data as CargoItem[]);
  };

  const fetchDriverLocation = async () => {
    const { data } = await supabase.from('job_driver_location_current').select('*').eq('job_id', jobId).maybeSingle();
    if (data) setDriverLoc(data as DriverLocation);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="bg-white rounded-2xl p-8"><Loader2 className="w-7 h-7 text-moveme-blue-600 animate-spin" /></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="bg-white rounded-2xl p-8 text-center">
          <p className="text-gray-600 mb-3">Job not found</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm">Close</button>
        </div>
      </div>
    );
  }

  const isActive = ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'in_progress', 'delivered', 'returning'].includes(job.status);
  const isCompleted = job.status === 'completed';
  const progressIndex = PROGRESS_STEPS.findIndex((s) => s.key === job.status);
  const showTrackingMap = isActive && stops.length > 0;
  const pickupStops = stops.filter((s) => s.stop_type === 'PICKUP');
  const dropoffStops = stops.filter((s) => s.stop_type === 'DROPOFF');
  const completedDropoffs = dropoffStops.filter((s) => s.status === 'COMPLETED');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50/95 backdrop-blur-sm animate-fade-in">
      <Header job={job} onClose={onClose} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {progressIndex >= 0 && (
            <ProgressStepper currentIndex={progressIndex} />
          )}

          {isActive && driverLoc && (
            <DriverLocationCard driverLoc={driverLoc} />
          )}

          {showTrackingMap && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-moveme-blue-600" />
                  <span className="text-sm font-semibold text-gray-900">Live Tracking</span>
                </div>
                {dropoffStops.length > 0 && (
                  <span className="text-xs text-gray-500 font-medium">
                    {completedDropoffs.length} / {dropoffStops.length} delivered
                  </span>
                )}
              </div>
              <div className="h-[350px]">
                <LiveTrackingMap
                  jobId={job.id}
                  deliveryStops={stops}
                  currentSelectedStopId={job.current_selected_stop_id}
                  routeType={job.route_type}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <PartiesCard
                customerName={customerName}
                courierProfile={courierProfile}
                job={job}
              />
              <PricingCard job={job} />
              {cargo.length > 0 && <CargoCard cargo={cargo} onImageClick={setSelectedImage} />}
            </div>
            <div className="space-y-6">
              {stops.length > 0 && <StopsTimeline stops={stops} onImageClick={setSelectedImage} />}
              {stops.length === 0 && <RouteCard job={job} />}
            </div>
          </div>

          {isCompleted && stops.length > 0 && (
            <PODEvidence stops={stops} onImageClick={setSelectedImage} />
          )}
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          <img src={selectedImage} alt="Full size" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

function Header({ job, onClose }: { job: FullJob; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const display = job.job_reference_id || job.id.slice(0, 8).toUpperCase();
  const handleCopy = () => {
    navigator.clipboard.writeText(job.job_reference_id || job.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
          <Hash className="w-4 h-4 text-gray-400" />
          <span className="text-base font-bold text-gray-900 tracking-wide">{display}</span>
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-success-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
        </button>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[job.status] || STATUS_COLORS.open}`}>
          {statusLabel(job.status)}
        </span>
        {job.created_at && (
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(job.created_at).toLocaleDateString()}
          </span>
        )}
      </div>
      <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

function ProgressStepper({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between overflow-x-auto gap-1">
        {PROGRESS_STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = i <= currentIndex;
          const active = i === currentIndex;
          return (
            <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  done ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-400'
                } ${active ? 'ring-4 ring-success-100 shadow-sm' : ''}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[10px] sm:text-xs font-medium text-center leading-tight whitespace-nowrap ${done ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
              {i < PROGRESS_STEPS.length - 1 && (
                <div className={`w-6 sm:w-12 h-0.5 rounded-full mt-[-18px] ${i < currentIndex ? 'bg-success-500' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DriverLocationCard({ driverLoc }: { driverLoc: DriverLocation }) {
  const stale = driverLoc.updated_at && (Date.now() - new Date(driverLoc.updated_at).getTime()) > 120000;
  const mapsUrl = `https://www.google.com/maps?q=${driverLoc.lat},${driverLoc.lng}`;
  return (
    <div className={`rounded-2xl border p-4 flex flex-wrap items-center gap-4 ${stale ? 'bg-warning-50 border-warning-200' : 'bg-moveme-blue-50 border-moveme-blue-100'}`}>
      <div className="flex items-center gap-2">
        <Navigation className={`w-5 h-5 ${stale ? 'text-warning-600' : 'text-moveme-blue-600'}`} />
        <span className="text-sm font-semibold text-gray-900">Driver GPS</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-700">
        <span>{driverLoc.lat.toFixed(5)}, {driverLoc.lng.toFixed(5)}</span>
        {driverLoc.speed != null && <span className="text-xs text-gray-500">{(driverLoc.speed * 3.6).toFixed(0)} km/h</span>}
      </div>
      <div className="flex items-center gap-3 ml-auto">
        {stale && (
          <span className="flex items-center gap-1 text-xs text-warning-700 font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> Stale
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {new Date(driverLoc.updated_at).toLocaleTimeString()}
        </span>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-moveme-blue-700 hover:underline">
          <ExternalLink className="w-3 h-3" /> Maps
        </a>
      </div>
    </div>
  );
}

function PartiesCard({ customerName, courierProfile, job }: { customerName: string; courierProfile: any; job: FullJob }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Parties</h3>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><User className="w-5 h-5 text-gray-400" /></div>
        <div>
          <p className="text-xs text-gray-400">Customer</p>
          <p className="text-sm font-semibold text-gray-900">{customerName}</p>
        </div>
      </div>
      {courierProfile ? (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-moveme-blue-50 flex items-center justify-center overflow-hidden">
            {courierProfile.profile?.avatar_url
              ? <img src={courierProfile.profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : <Truck className="w-5 h-5 text-moveme-blue-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Courier</p>
            <p className="text-sm font-semibold text-gray-900">{courierProfile.profile?.full_name || 'Unknown'}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              {courierProfile.vehicle_make && <span>{courierProfile.vehicle_make} {courierProfile.vehicle_model}</span>}
              {courierProfile.vehicle_plate && <span className="font-mono">{courierProfile.vehicle_plate}</span>}
            </div>
            {courierProfile.profile?.phone && (
              <a href={`tel:${courierProfile.profile.phone}`} className="flex items-center gap-1 text-xs text-moveme-blue-600 mt-0.5">
                <Phone className="w-3 h-3" />{courierProfile.profile.phone}
              </a>
            )}
            {courierProfile.profile?.rating_average != null && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <span className="font-medium">{Number(courierProfile.profile.rating_average).toFixed(1)} rating</span>
                <span>{courierProfile.profile.completed_deliveries_count || 0} deliveries</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center"><Truck className="w-5 h-5 text-gray-300" /></div>
          <div><p className="text-xs text-gray-400">Courier</p><p className="text-sm text-gray-500">Unassigned</p></div>
        </div>
      )}
      {(job.assigned_company_name || job.assigned_driver_name) && (
        <div className="pt-3 border-t border-gray-100 space-y-2">
          {job.assigned_company_name && (
            <div className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{job.assigned_company_name}</span></div>
          )}
          {job.assigned_driver_name && (
            <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-gray-400" /><span className="text-gray-700">Driver: {job.assigned_driver_name}</span></div>
          )}
        </div>
      )}
    </div>
  );
}

function PricingCard({ job }: { job: FullJob }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pricing</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Customer Offer</span><span className="font-medium text-gray-900">{ttd(job.customer_offer_ttd)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Platform Fee</span><span className="font-medium text-gray-900">{ttd(job.platform_fee)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Courier Earnings</span><span className="font-medium text-gray-900">{ttd(job.courier_earnings)}</span></div>
        <div className="border-t border-gray-100 pt-2 flex justify-between">
          <span className="font-semibold text-gray-700">Total</span>
          <span className="font-bold text-gray-900 text-base">{ttd(job.total_price)}</span>
        </div>
      </div>
    </div>
  );
}

function CargoCard({ cargo, onImageClick }: { cargo: CargoItem[]; onImageClick: (url: string) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargo Items ({cargo.length})</h3>
      <div className="space-y-2">
        {cargo.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            {item.cargo_photo_url && (
              <img
                src={item.cargo_photo_url}
                alt=""
                className="w-12 h-12 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80"
                onClick={() => onImageClick(item.cargo_photo_url!)}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 capitalize">
                {item.cargo_category === 'other' ? item.cargo_category_custom : item.cargo_category || 'Item'}
              </p>
              {item.cargo_size_category && <p className="text-xs text-gray-500 capitalize">{item.cargo_size_category}</p>}
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              item.status === 'delivered' ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {item.status === 'delivered' ? 'Delivered' : 'Pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StopsTimeline({ stops, onImageClick }: { stops: DeliveryStop[]; onImageClick: (url: string) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivery Stops ({stops.length})</h3>
      <div className="space-y-0">
        {stops.map((stop, i) => {
          const style = STOP_STATUS_STYLES[stop.status] || STOP_STATUS_STYLES.NOT_STARTED;
          const pod = Array.isArray(stop.pod_stops) ? stop.pod_stops[0] : stop.pod_stops;
          const isLast = i === stops.length - 1;
          return (
            <div key={stop.id} className="relative flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  stop.status === 'COMPLETED' ? 'bg-success-600 text-white' : `${style.bg} ${style.text} border border-current/20`
                }`}>
                  {stop.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4" /> : stop.stop_index + 1}
                </div>
                {!isLast && <div className={`w-0.5 flex-1 min-h-[24px] ${stop.status === 'COMPLETED' ? 'bg-success-300' : 'bg-gray-200'}`} />}
              </div>
              <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${stop.stop_type === 'PICKUP' ? 'text-moveme-blue-600' : 'text-success-600'}`}>
                        {stop.stop_type}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {stop.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">{stop.location_text}</p>
                    {stop.contact_name && <p className="text-xs text-gray-500 mt-0.5">{stop.contact_name}{stop.contact_phone ? ` - ${stop.contact_phone}` : ''}</p>}
                  </div>
                </div>
                {(stop.arrived_at || stop.completed_at) && (
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    {stop.arrived_at && <span>Arrived: {new Date(stop.arrived_at).toLocaleTimeString()}</span>}
                    {stop.completed_at && <span>Done: {new Date(stop.completed_at).toLocaleTimeString()}</span>}
                  </div>
                )}
                {pod && pod.status === 'COMPLETED' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pod.photo_urls && pod.photo_urls.map((url: string, idx: number) => (
                      <img key={idx} src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80" onClick={() => onImageClick(url)} />
                    ))}
                    {pod.signature_image_url && (
                      <div className="bg-white border border-gray-200 rounded-lg p-1 cursor-pointer hover:opacity-80" onClick={() => onImageClick(pod.signature_image_url!)}>
                        <img src={pod.signature_image_url} alt="Signature" className="h-12 max-w-[80px] object-contain" />
                      </div>
                    )}
                    {pod.recipient_name && <span className="text-xs text-gray-500 self-end">Rcvd: {pod.recipient_name}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RouteCard({ job }: { job: FullJob }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Route</h3>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-moveme-blue-50 flex items-center justify-center mt-0.5"><MapPin className="w-4 h-4 text-moveme-blue-600" /></div>
          <div><p className="text-xs text-gray-400">Pickup</p><p className="text-sm font-medium text-gray-900">{job.pickup_location_text}</p></div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center mt-0.5"><MapPin className="w-4 h-4 text-success-600" /></div>
          <div><p className="text-xs text-gray-400">Dropoff</p><p className="text-sm font-medium text-gray-900">{job.dropoff_location_text}</p></div>
        </div>
      </div>
    </div>
  );
}

function PODEvidence({ stops, onImageClick }: { stops: DeliveryStop[]; onImageClick: (url: string) => void }) {
  const dropoffs = stops.filter((s) => s.stop_type === 'DROPOFF' && s.status === 'COMPLETED');
  const hasPod = dropoffs.some((s) => {
    const pod = Array.isArray(s.pod_stops) ? s.pod_stops[0] : s.pod_stops;
    return pod && (pod.photo_urls?.length || pod.signature_image_url);
  });
  if (!hasPod) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-gray-400" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Proof of Delivery</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dropoffs.map((stop, idx) => {
          const pod = Array.isArray(stop.pod_stops) ? stop.pod_stops[0] : stop.pod_stops;
          if (!pod || (!pod.photo_urls?.length && !pod.signature_image_url)) return null;
          return (
            <div key={stop.id} className="border border-success-200 rounded-xl p-4 bg-success-50/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-success-600 text-white flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                <span className="text-sm font-medium text-gray-900">{stop.location_text}</span>
              </div>
              {pod.recipient_name && (
                <p className="text-xs text-gray-600 mb-2">Received by: <span className="font-medium">{pod.recipient_name}</span></p>
              )}
              {pod.notes && <p className="text-xs text-gray-500 italic mb-2">{pod.notes}</p>}
              <div className="flex flex-wrap gap-2">
                {pod.photo_urls?.map((url: string, pIdx: number) => (
                  <img key={pIdx} src={url} alt={`Proof ${pIdx + 1}`} className="w-20 h-20 object-cover rounded-lg border-2 border-success-300 cursor-pointer hover:opacity-80" onClick={() => onImageClick(url)} />
                ))}
                {pod.signature_image_url && (
                  <div className="bg-white border-2 border-success-300 rounded-lg p-1.5 cursor-pointer hover:opacity-80" onClick={() => onImageClick(pod.signature_image_url!)}>
                    <img src={pod.signature_image_url} alt="Signature" className="h-16 max-w-[120px] object-contain" />
                    {pod.signed_by_name && <p className="text-[10px] text-gray-500 mt-1 text-center">{pod.signed_by_name}</p>}
                  </div>
                )}
              </div>
              {pod.completed_at && <p className="text-xs text-gray-400 mt-2">{new Date(pod.completed_at).toLocaleString()}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
