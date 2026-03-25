import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { calculatePriceRecommendation, calculateBookingLikelihood, calculatePaymentBreakdown, calculateCustomerFees, formatCurrency, fetchPlatformFeePercentage, DEFAULT_PLATFORM_FEE } from '../lib/pricing';
import { GooglePlacesAutocomplete } from '../components/GooglePlacesAutocomplete';
import { LocationMapPicker } from '../components/LocationMapPicker';
import { RouteMapPlanner, RouteLocation, PickupGroup } from '../components/RouteMapPlanner';
import { LikelihoodGraph } from '../components/LikelihoodGraph';
import { AddPaymentModal } from '../components/AddPaymentModal';
import { NotificationToast } from '../components/NotificationToast';
import { SavedAddressPicker } from '../components/SavedAddressPicker';
import { useGoogleMaps } from '../hooks/useGoogleMaps';
import { formatMinutesToHoursMinutes } from '../lib/timeUtils';
import { JobTypeSelector, JobType } from '../components/JobTypeSelector';
import { CourierCargoSelector, CourierCargoSize } from '../components/courier/CourierCargoSelector';
import { CourierHandoverForm } from '../components/courier/CourierHandoverForm';
import { CourierSafetyCheckbox } from '../components/courier/CourierSafetyCheckbox';
import { AuctionInfoPopup } from '../components/AuctionInfoPopup';
import { getPreferredDispatchExpiry, getRetailPreferredCourierIds } from '../lib/preferredDispatch';
import { Loader2, ArrowLeft, Package, Truck, Sofa, Laptop, Car, Wrench, Box, Layers, FileQuestion, Upload, X, Zap, Calendar, DollarSign, Gavel, CreditCard, Receipt, AlertTriangle, Shield, Dumbbell, Lock, Settings, ChevronDown, ChevronUp, Plus, Trash2, MapPin, Camera, FileCheck, BookmarkPlus, Save, Banknote, Gem, ShieldCheck, ShoppingBag, ShoppingCart, Link, ListChecks, Phone, Eye, Image, ClipboardList, CircleUser as UserCircle, Users, Star } from 'lucide-react';

interface LocationData {
  text: string;
  lat: number;
  lng: number;
}

interface CargoItem {
  id: string;
  cargoSize: 'small' | 'medium' | 'large';
  cargoCategory: 'furniture' | 'electronics' | 'vehicles' | 'equipment' | 'pallets' | 'boxes' | 'other';
  cargoCategoryCustom: string;
  cargoWeight: string;
  weightUnit: 'kg' | 'lbs';
  cargoNotes: string;
  cargoPhoto: File | null;
  cargoPhotoPreview: string;
  dropoffLocation: LocationData;
  dropoffContactName: string;
  dropoffContactPhone: string;
  assignedStopIndex: number;
  assignedStopId: string;
  assignedPickupGroupId?: string;
  isExtra?: boolean;
  dimensionsLength: string;
  dimensionsWidth: string;
  dimensionsHeight: string;
  dimensionsUnit: 'cm' | 'in' | 'ft';
  dimensionsLengthUnit: 'cm' | 'in' | 'ft';
  dimensionsWidthUnit: 'cm' | 'in' | 'ft';
  dimensionsHeightUnit: 'cm' | 'in' | 'ft';
}

const TRINIDAD_LANDFILLS = [
  { name: 'Beetham Landfill', lat: 10.6400, lng: -61.4850, address: 'Beetham Estate, Sea Lots, Port of Spain' },
  { name: 'Forres Park Landfill', lat: 10.2770, lng: -61.4680, address: 'Forres Park, Claxton Bay' },
  { name: 'Guanapo Landfill', lat: 10.6250, lng: -61.3130, address: 'Guanapo, Arima' },
  { name: 'Guapo Landfill', lat: 10.1590, lng: -61.6370, address: 'Guapo, Point Fortin' },
];

const JUNK_WASTE_CATEGORY_OPTIONS = [
  'Furniture',
  'Appliances',
  'Construction Debris',
  'Yard Waste',
  'Electronics',
  'Mattresses & Bedding',
  'General Household',
];

function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function CreateJobPage({ onBack, onJobCreated, editJobId }: { onBack: () => void; onJobCreated: () => void; editJobId?: string }) {
  const { user } = useAuth();
  const { isLoaded: mapsLoaded } = useGoogleMaps();
  const [step, setStep] = useState(1);
  const [loadingJobData, setLoadingJobData] = useState(!!editJobId);
  const [editMode, setEditMode] = useState(!!editJobId);
  const [editDataLoaded, setEditDataLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [hasPaymentInfo, setHasPaymentInfo] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [userBusinessType, setUserBusinessType] = useState<string | null>(null);
  const [showSavedAddressPicker, setShowSavedAddressPicker] = useState(false);
  const [savedAddressTarget, setSavedAddressTarget] = useState<'pickup' | 'dropoff'>('pickup');
  const [showSaveAddressModal, setShowSaveAddressModal] = useState(false);
  const [saveAddressData, setSaveAddressData] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [saveAddressLabel, setSaveAddressLabel] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const [jobType, setJobType] = useState<JobType>('standard');
  const [marketplaceSellerContact, setMarketplaceSellerContact] = useState('');
  const [marketplaceSellerPhone, setMarketplaceSellerPhone] = useState('');
  const [marketplaceListingUrl, setMarketplaceListingUrl] = useState('');
  const [marketplaceMaxBudget, setMarketplaceMaxBudget] = useState('');
  const [marketplaceItemScreenshot, setMarketplaceItemScreenshot] = useState<File | null>(null);
  const [marketplaceItemScreenshotPreview, setMarketplaceItemScreenshotPreview] = useState('');
  const [marketplaceInspectionInstructions, setMarketplaceInspectionInstructions] = useState('');
  const [marketplacePaymentStatus, setMarketplacePaymentStatus] = useState<'already_paid' | 'pay_after_inspection' | ''>('');
  const [marketplaceCashWarning, setMarketplaceCashWarning] = useState(false);
  const [marketplaceRequirePhoto, setMarketplaceRequirePhoto] = useState(false);
  const [junkDisposalType, setJunkDisposalType] = useState('');
  const [junkTippingFeeIncluded, setJunkTippingFeeIncluded] = useState(true);
  const [junkWasteCategories, setJunkWasteCategories] = useState<string[]>([]);
  const [junkSafetyAcknowledged, setJunkSafetyAcknowledged] = useState(false);
  const [junkPhoto, setJunkPhoto] = useState<File | null>(null);
  const [junkPhotoPreview, setJunkPhotoPreview] = useState('');
  const [junkCurbside, setJunkCurbside] = useState(true);
  const [junkNeedExtraHand, setJunkNeedExtraHand] = useState(false);
  const JUNK_NOT_ON_CURB_FEE = 100;
  const JUNK_EXTRA_HAND_FEE = 150;
  const JUNK_TIPPING_FEE = 100;

  const [courierCargoSize, setCourierCargoSize] = useState<CourierCargoSize | null>(null);
  const [courierRecipientName, setCourierRecipientName] = useState('');
  const [courierRecipientPhone, setCourierRecipientPhone] = useState('');
  const [courierBuildingDetails, setCourierBuildingDetails] = useState('');
  const [courierRequireSignature, setCourierRequireSignature] = useState(false);
  const [courierSafetyAcknowledged, setCourierSafetyAcknowledged] = useState(false);

  const [sendToPreferredFirst, setSendToPreferredFirst] = useState(false);
  const [hasPreferredCouriers, setHasPreferredCouriers] = useState(false);

  const [pickup, setPickup] = useState<LocationData>({ text: '', lat: 0, lng: 0 });
  const [dropoff, setDropoff] = useState<LocationData>({ text: '', lat: 0, lng: 0 });
  const [distance, setDistance] = useState(0);

  const [isMultiStop, setIsMultiStop] = useState(false);
  const [hasMultiplePickups, setHasMultiplePickups] = useState(false);
  const [multiStopPickups, setMultiStopPickups] = useState<RouteLocation[]>([
    { id: 'pickup-1', address: '', lat: 0, lng: 0 }
  ]);
  const [multiStopDropoffs, setMultiStopDropoffs] = useState<RouteLocation[]>([
    { id: 'dropoff-1', address: '', lat: 0, lng: 0 },
    { id: 'dropoff-2', address: '', lat: 0, lng: 0 }
  ]);
  const [multiStopDistance, setMultiStopDistance] = useState(0);
  const [multiStopEta, setMultiStopEta] = useState(0);

  const [pickupGroups, setPickupGroups] = useState<PickupGroup[]>([{
    id: 'pickup-group-1',
    pickup: { id: 'pickup-1', address: '', lat: 0, lng: 0 },
    dropoffs: [
      { id: 'dropoff-1', address: '', lat: 0, lng: 0 },
      { id: 'dropoff-2', address: '', lat: 0, lng: 0 }
    ]
  }]);

  const [cargoItems, setCargoItems] = useState<CargoItem[]>([{
    id: '1',
    cargoSize: 'small',
    cargoCategory: 'boxes',
    cargoCategoryCustom: '',
    cargoWeight: '',
    weightUnit: 'kg',
    cargoNotes: '',
    cargoPhoto: null,
    cargoPhotoPreview: '',
    dropoffLocation: { text: '', lat: 0, lng: 0 },
    dropoffContactName: '',
    dropoffContactPhone: '',
    assignedStopIndex: 0,
    assignedStopId: 'dropoff-1',
    dimensionsLength: '',
    dimensionsWidth: '',
    dimensionsHeight: '',
    dimensionsUnit: 'ft',
    dimensionsLengthUnit: 'ft',
    dimensionsWidthUnit: 'in',
    dimensionsHeightUnit: 'in'
  }]);
  const [expandedCargoId, setExpandedCargoId] = useState<string>('1');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [showSpecialRequirements, setShowSpecialRequirements] = useState(false);
  const [isFragile, setIsFragile] = useState(false);
  const [needsCover, setNeedsCover] = useState(false);
  const [requiresHeavyLift, setRequiresHeavyLift] = useState(false);
  const [hasSecurityGate, setHasSecurityGate] = useState(false);
  const [specialRequirementsNotes, setSpecialRequirementsNotes] = useState('');
  const [showProofOfDelivery, setShowProofOfDelivery] = useState(false);
  const [proofOfDelivery, setProofOfDelivery] = useState<'PHOTO' | 'SIGNATURE' | 'PHOTO_AND_SIGNATURE' | 'NONE'>('NONE');
  const [deliveryOrderType, setDeliveryOrderType] = useState<'flexible' | 'sequential'>('sequential');
  const [hasMultipleDropoffs, setHasMultipleDropoffs] = useState(false);
  const [sameCargoForAllStops, setSameCargoForAllStops] = useState(false);

  const [deliveryType, setDeliveryType] = useState<'asap' | 'scheduled'>('asap');
  const [scheduledPickupDate, setScheduledPickupDate] = useState('');
  const [scheduledPickupTime, setScheduledPickupTime] = useState('');
  const [pickupHour, setPickupHour] = useState('12');
  const [pickupMinute, setPickupMinute] = useState('00');
  const [pickupPeriod, setPickupPeriod] = useState<'AM' | 'PM'>('PM');
  const [scheduledDropoffDate, setScheduledDropoffDate] = useState('');
  const [scheduledDropoffTime, setScheduledDropoffTime] = useState('');
  const [urgencyHours, setUrgencyHours] = useState(24);

  const [cashToReturn, setCashToReturn] = useState(false);
  const [cashToReturnAmount, setCashToReturnAmount] = useState('');

  const [declaredCargoValue, setDeclaredCargoValue] = useState('');
  const [cargoInsuranceEnabled, setCargoInsuranceEnabled] = useState(false);

  const [platformFeePercent, setPlatformFeePercent] = useState(DEFAULT_PLATFORM_FEE);

  useEffect(() => {
    fetchPlatformFeePercentage().then(fee => setPlatformFeePercent(fee));
  }, []);

  const INSURANCE_RATE = 0.015;
  const HIGH_VALUE_THRESHOLD = 10000;
  const INSURANCE_TRIGGER_THRESHOLD = 1000;
  const parsedCargoValue = parseFloat(declaredCargoValue) || 0;
  const insuranceFee = cargoInsuranceEnabled ? Math.round(parsedCargoValue * INSURANCE_RATE * 100) / 100 : 0;
  const isHighValue = parsedCargoValue > HIGH_VALUE_THRESHOLD;
  const showInsuranceToggle = parsedCargoValue > INSURANCE_TRIGGER_THRESHOLD;

  const [pricingType, setPricingType] = useState<'fixed' | 'bid'>('fixed');
  const [showAuctionInfo, setShowAuctionInfo] = useState(false);
  const [priceInputMode, setPriceInputMode] = useState<'slider' | 'custom'>('slider');
  const [customerOffer, setCustomerOffer] = useState(100);
  const [customPriceInput, setCustomPriceInput] = useState('');

  const [priceRec, setPriceRec] = useState<{ low: number; mid: number; high: number } | null>(null);
  const [likelihood, setLikelihood] = useState<any>(null);

  useEffect(() => {
    checkPaymentInfo();
  }, [user]);

  useEffect(() => {
    if (editJobId && user) {
      fetchJobDataForEdit();
    }
  }, [editJobId, user]);

  const fetchJobDataForEdit = async () => {
    if (!editJobId || !user) return;

    setLoadingJobData(true);
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          cargo_items(*)
        `)
        .eq('id', editJobId)
        .single();

      if (jobError) throw jobError;

      if (jobData.customer_user_id !== user.id) {
        setError('You do not have permission to edit this job');
        setLoadingJobData(false);
        return;
      }

      if (!['open', 'bidding', 'draft'].includes(jobData.status)) {
        setError("This job can't be edited after a driver has accepted it.");
        setLoadingJobData(false);
        return;
      }

      let parsedPickups: RouteLocation[] = [];
      let parsedDropoffs: RouteLocation[] = [];

      if (jobData.pickups && typeof jobData.pickups === 'string') {
        try {
          parsedPickups = JSON.parse(jobData.pickups);
        } catch (e) {
          console.error('Error parsing pickups:', e);
        }
      }

      if (jobData.dropoffs && typeof jobData.dropoffs === 'string') {
        try {
          parsedDropoffs = JSON.parse(jobData.dropoffs);
        } catch (e) {
          console.error('Error parsing dropoffs:', e);
        }
      }

      const hasMultipleUniqueDropoffsInCargo = jobData.cargo_items && jobData.cargo_items.length > 1 && new Set(
        jobData.cargo_items.map((item: any) => item.dropoff_location_text || jobData.dropoff_location_text)
      ).size > 1;

      const isJobMultiStop = jobData.is_multi_stop || parsedDropoffs.length > 1 || parsedPickups.length > 1 || hasMultipleUniqueDropoffsInCargo || false;
      const hasJobMultiplePickups = jobData.has_multiple_pickups || parsedPickups.length > 1 || false;

      setPickup({ text: jobData.pickup_location_text, lat: jobData.pickup_lat, lng: jobData.pickup_lng });
      setDropoff({ text: jobData.dropoff_location_text, lat: jobData.dropoff_lat, lng: jobData.dropoff_lng });
      setDistance(jobData.distance_km);
      setUrgencyHours(jobData.urgency_hours || 24);
      setCustomerOffer(jobData.customer_offer_ttd || 100);

      if (jobData.delivery_order_type) {
        setDeliveryOrderType(jobData.delivery_order_type);
      }

      if (jobData.proof_of_delivery) {
        setProofOfDelivery(jobData.proof_of_delivery);
        setShowProofOfDelivery(true);
      }

      if (jobData.is_fragile || jobData.needs_cover || jobData.requires_heavy_lift || jobData.has_security_gate) {
        setShowSpecialRequirements(true);
        setIsFragile(jobData.is_fragile || false);
        setNeedsCover(jobData.needs_cover || false);
        setRequiresHeavyLift(jobData.requires_heavy_lift || false);
        setHasSecurityGate(jobData.has_security_gate || false);
      }

      if (jobData.special_requirements_notes) {
        setSpecialRequirementsNotes(jobData.special_requirements_notes);
      }

      if (jobData.job_type) {
        setJobType(jobData.job_type as JobType);
      }
      if (jobData.marketplace_seller_contact) setMarketplaceSellerContact(jobData.marketplace_seller_contact);
      if (jobData.marketplace_listing_url) setMarketplaceListingUrl(jobData.marketplace_listing_url);
      if (jobData.marketplace_max_budget) setMarketplaceMaxBudget(String(jobData.marketplace_max_budget));
      if (jobData.junk_disposal_type) setJunkDisposalType(jobData.junk_disposal_type);
      if (jobData.junk_tipping_fee_included !== undefined) setJunkTippingFeeIncluded(jobData.junk_tipping_fee_included);

      if (isJobMultiStop) {
        setIsMultiStop(true);

        if (parsedPickups.length > 0) {
          setMultiStopPickups(parsedPickups);
        }

        if (parsedDropoffs.length > 0) {
          setMultiStopDropoffs(parsedDropoffs);
        } else if (hasMultipleUniqueDropoffsInCargo && jobData.cargo_items) {
          const uniqueDropoffs = Array.from(
            new Set(
              jobData.cargo_items
                .filter((item: any) => item.dropoff_location_text)
                .map((item: any) => JSON.stringify({
                  address: item.dropoff_location_text,
                  lat: item.dropoff_lat,
                  lng: item.dropoff_lng
                }))
            )
          ).map((str: any, idx: number) => {
            const parsed = JSON.parse(str);
            return {
              id: `dropoff-${idx + 1}`,
              address: parsed.address,
              lat: parsed.lat,
              lng: parsed.lng
            };
          });

          if (uniqueDropoffs.length > 0) {
            setMultiStopDropoffs(uniqueDropoffs);
            parsedDropoffs = uniqueDropoffs;
          }
        }

        if (hasJobMultiplePickups) {
          setHasMultiplePickups(true);
          if (parsedPickups.length > 0 && parsedDropoffs.length > 0) {
            const groups: PickupGroup[] = parsedPickups.map((pickup, idx) => ({
              id: pickup.id || `pickup-group-${idx + 1}`,
              pickup: pickup,
              dropoffs: parsedDropoffs.filter(d => d.label?.startsWith(`P${idx + 1}`))
            }));
            setPickupGroups(groups.length > 0 ? groups : [{
              id: 'pickup-group-1',
              pickup: parsedPickups[0],
              dropoffs: parsedDropoffs
            }]);
          }
        }

        if (jobData.total_distance_km) {
          setMultiStopDistance(jobData.total_distance_km);
        }
        if (jobData.eta_minutes) {
          setMultiStopEta(jobData.eta_minutes);
        }
      }

      if (jobData.cargo_items && jobData.cargo_items.length > 0) {
        const items: CargoItem[] = await Promise.all(jobData.cargo_items.map(async (item: any, idx: number) => {
          let cargoPhotoPreview = '';
          if (item.cargo_photo_url) {
            cargoPhotoPreview = item.cargo_photo_url;
          }

          const dropoffLoc = item.dropoff_location_text
            ? {
                text: item.dropoff_location_text,
                lat: item.dropoff_lat || jobData.dropoff_lat,
                lng: item.dropoff_lng || jobData.dropoff_lng
              }
            : { text: jobData.dropoff_location_text, lat: jobData.dropoff_lat, lng: jobData.dropoff_lng };

          let assignedStopId = 'dropoff-1';
          let assignedStopIndex = 0;

          if (item.assigned_stop_id) {
            assignedStopId = item.assigned_stop_id;
            assignedStopIndex = item.assigned_stop_index || 0;
          } else if (item.dropoff_location_text && parsedDropoffs.length > 0) {
            const matchingDropoff = parsedDropoffs.find(d =>
              d.address === item.dropoff_location_text ||
              (d.lat === item.dropoff_lat && d.lng === item.dropoff_lng)
            );
            if (matchingDropoff) {
              assignedStopId = matchingDropoff.id;
              assignedStopIndex = parsedDropoffs.findIndex(d => d.id === matchingDropoff.id);
            }
          }

          return {
            id: item.id || `${idx + 1}`,
            cargoSize: item.cargo_size_category,
            cargoCategory: item.cargo_category,
            cargoCategoryCustom: item.cargo_category_custom || '',
            cargoWeight: item.cargo_weight_kg ? String(item.cargo_weight_kg) : '',
            weightUnit: 'kg' as 'kg',
            cargoNotes: item.cargo_notes || '',
            cargoPhoto: null,
            cargoPhotoPreview: cargoPhotoPreview,
            dropoffLocation: dropoffLoc,
            dropoffContactName: item.dropoff_contact_name || '',
            dropoffContactPhone: item.dropoff_contact_phone || '',
            assignedStopIndex: assignedStopIndex,
            assignedStopId: assignedStopId,
            isExtra: false,
            dimensionsLength: item.dimensions_length ? String(item.dimensions_length) : '',
            dimensionsWidth: item.dimensions_width ? String(item.dimensions_width) : '',
            dimensionsHeight: item.dimensions_height ? String(item.dimensions_height) : '',
            dimensionsUnit: (item.dimensions_unit || 'ft') as 'cm' | 'in' | 'ft',
            dimensionsLengthUnit: (item.dimensions_length_unit || item.dimensions_unit || 'ft') as 'cm' | 'in' | 'ft',
            dimensionsWidthUnit: (item.dimensions_width_unit || item.dimensions_unit || 'in') as 'cm' | 'in' | 'ft',
            dimensionsHeightUnit: (item.dimensions_height_unit || item.dimensions_unit || 'in') as 'cm' | 'in' | 'ft'
          };
        }));

        setCargoItems(items);
        if (items.length > 0) {
          setExpandedCargoId(items[0].id);
        }
      }

      setLoadingJobData(false);
      setEditDataLoaded(true);
    } catch (error) {
      console.error('Error fetching job data:', error);
      setError('Failed to load job data');
      setLoadingJobData(false);
    }
  };

  const checkPaymentInfo = async () => {
    if (!user) return;

    setCheckingPayment(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('customer_payment_verified, business_type')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setHasPaymentInfo(data?.customer_payment_verified || false);
      setUserBusinessType(data?.business_type || null);

      if (data?.business_type === 'retail') {
        getRetailPreferredCourierIds(user!.id).then(ids => {
          setHasPreferredCouriers(ids.length > 0);
        });
      }
    } catch (err) {
      console.error('Error checking payment info:', err);
    } finally {
      setCheckingPayment(false);
    }
  };

  useEffect(() => {
    if (pickup.lat && dropoff.lat && pickup.lat !== 0 && dropoff.lat !== 0) {
      calculateDistance();
    }
  }, [pickup, dropoff]);

  useEffect(() => {
    if (jobType === 'junk_removal' && pickup.lat !== 0 && pickup.lng !== 0) {
      let nearest = TRINIDAD_LANDFILLS[0];
      let minDist = Infinity;
      for (const landfill of TRINIDAD_LANDFILLS) {
        const d = calculateHaversineDistance(pickup.lat, pickup.lng, landfill.lat, landfill.lng);
        if (d < minDist) {
          minDist = d;
          nearest = landfill;
        }
      }
      setDropoff({ text: `${nearest.name} - ${nearest.address}`, lat: nearest.lat, lng: nearest.lng });
    }
  }, [jobType, pickup.lat, pickup.lng]);

  useEffect(() => {
    const effectiveDistance = isMultiStop ? multiStopDistance : distance;
    if (effectiveDistance > 0 && cargoItems.length > 0 && urgencyHours) {
      fetchRecommendations();
    }
  }, [distance, multiStopDistance, cargoItems, urgencyHours, customerOffer, isMultiStop, jobType, isFragile, requiresHeavyLift, needsCover, hasSecurityGate, declaredCargoValue, cargoInsuranceEnabled]);

  useEffect(() => {
    const isRetailOrHaulage = userBusinessType === 'retail' || userBusinessType === 'haulage';
    if (!isRetailOrHaulage || !isMultiStop || hasMultiplePickups) return;

    if (editMode && !editDataLoaded) return;

    const validDropoffs = multiStopDropoffs.filter(d => d.lat !== 0 || d.lng !== 0 || d.address !== '');

    const autoCargoItems = cargoItems.filter(c => !c.isExtra && !c.assignedPickupGroupId);
    const existingCargoStopIds = new Set(autoCargoItems.map(c => c.assignedStopId));
    const currentDropoffIds = new Set(validDropoffs.map(d => d.id));

    const dropoffsToAdd = validDropoffs.filter(d => !existingCargoStopIds.has(d.id));
    const cargoToRemove = autoCargoItems.filter(c => !currentDropoffIds.has(c.assignedStopId));

    if (dropoffsToAdd.length > 0) {
      const templateCargo = autoCargoItems[0];
      const newCargoItems = dropoffsToAdd.map((dropoff, idx) => {
        const newId = `cargo-${Date.now()}-${idx}`;
        const stopIndex = multiStopDropoffs.findIndex(d => d.id === dropoff.id);

        return {
          id: newId,
          cargoSize: sameCargoForAllStops && templateCargo ? templateCargo.cargoSize : 'small' as 'small' | 'medium' | 'large',
          cargoCategory: sameCargoForAllStops && templateCargo ? templateCargo.cargoCategory : 'boxes' as 'furniture' | 'electronics' | 'vehicles' | 'equipment' | 'pallets' | 'boxes' | 'other',
          cargoCategoryCustom: sameCargoForAllStops && templateCargo ? templateCargo.cargoCategoryCustom : '',
          cargoWeight: sameCargoForAllStops && templateCargo ? templateCargo.cargoWeight : '',
          weightUnit: sameCargoForAllStops && templateCargo ? templateCargo.weightUnit : 'kg' as 'kg' | 'lbs',
          cargoNotes: sameCargoForAllStops && templateCargo ? templateCargo.cargoNotes : '',
          cargoPhoto: null,
          cargoPhotoPreview: '',
          dropoffLocation: { text: '', lat: 0, lng: 0 },
          dropoffContactName: '',
          dropoffContactPhone: '',
          dimensionsLength: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsLength : '',
          dimensionsWidth: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsWidth : '',
          dimensionsHeight: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsHeight : '',
          dimensionsUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsUnit : 'ft' as 'cm' | 'in' | 'ft',
          dimensionsLengthUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsLengthUnit : 'ft' as 'cm' | 'in' | 'ft',
          dimensionsWidthUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsWidthUnit : 'in' as 'cm' | 'in' | 'ft',
          dimensionsHeightUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsHeightUnit : 'in' as 'cm' | 'in' | 'ft',
          assignedStopIndex: stopIndex,
          assignedStopId: dropoff.id,
          isExtra: false
        };
      });

      setCargoItems(prev => [...prev, ...newCargoItems]);
    }

    if (cargoToRemove.length > 0 && autoCargoItems.length > 1) {
      const removeIds = new Set(cargoToRemove.map(c => c.id));
      setCargoItems(prev => prev.filter(c => !removeIds.has(c.id)));
    }
  }, [multiStopDropoffs, isMultiStop, hasMultiplePickups, userBusinessType, sameCargoForAllStops, editMode, editDataLoaded]);

  useEffect(() => {
    const isRetailOrHaulage = userBusinessType === 'retail' || userBusinessType === 'haulage';

    if (!isRetailOrHaulage || !isMultiStop) return;

    if (!hasMultiplePickups) {
      const pickupCargoItems = cargoItems.filter(c => c.assignedPickupGroupId);
      if (pickupCargoItems.length > 0) {
        setCargoItems(prev => prev.map(item => {
          if (item.assignedPickupGroupId) {
            return {
              ...item,
              assignedPickupGroupId: undefined
            };
          }
          return item;
        }));
      }
      return;
    }

    if (editMode && !editDataLoaded) return;

    const autoCargoItems = cargoItems.filter(c => !c.isExtra && c.assignedPickupGroupId);
    const existingCargoKeys = new Set(
      autoCargoItems.map(c => `${c.assignedPickupGroupId}-${c.assignedStopId}`)
    );

    const cargoToAdd: CargoItem[] = [];
    const cargoToRemove: CargoItem[] = [];
    const cargoToUpdate: CargoItem[] = [];

    const allDropoffsMap = new Map<string, { pickupGroupId: string; dropoffId: string; globalStopIndex: number }>();
    let globalStopCounter = 0;

    pickupGroups.forEach((group) => {
      group.dropoffs.forEach((dropoff) => {
        const key = `${group.id}-${dropoff.id}`;
        allDropoffsMap.set(key, {
          pickupGroupId: group.id,
          dropoffId: dropoff.id,
          globalStopIndex: globalStopCounter
        });
        globalStopCounter++;
      });
    });

    if (autoCargoItems.length === 0 && allDropoffsMap.size > 0) {
      const existingNonPickupCargo = cargoItems.filter(c => !c.isExtra && !c.assignedPickupGroupId);
      const templateCargo = existingNonPickupCargo[0] || cargoItems[0];
      let isFirstCargo = true;

      allDropoffsMap.forEach(({ pickupGroupId, dropoffId, globalStopIndex }) => {
        const key = `${pickupGroupId}-${dropoffId}`;

        if (isFirstCargo && templateCargo && !templateCargo.assignedPickupGroupId) {
          cargoToUpdate.push({
            ...templateCargo,
            assignedPickupGroupId: pickupGroupId,
            assignedStopIndex: globalStopIndex,
            assignedStopId: dropoffId,
            isExtra: false
          });
          isFirstCargo = false;
        } else {
          const newId = `cargo-${pickupGroupId}-${dropoffId}-${Date.now()}`;
          cargoToAdd.push({
            id: newId,
            cargoSize: sameCargoForAllStops && templateCargo ? templateCargo.cargoSize : 'small',
            cargoCategory: sameCargoForAllStops && templateCargo ? templateCargo.cargoCategory : 'boxes',
            cargoCategoryCustom: sameCargoForAllStops && templateCargo ? templateCargo.cargoCategoryCustom : '',
            cargoWeight: sameCargoForAllStops && templateCargo ? templateCargo.cargoWeight : '',
            weightUnit: sameCargoForAllStops && templateCargo ? templateCargo.weightUnit : 'kg',
            cargoNotes: sameCargoForAllStops && templateCargo ? templateCargo.cargoNotes : '',
            cargoPhoto: null,
            cargoPhotoPreview: '',
            dropoffLocation: { text: '', lat: 0, lng: 0 },
            dropoffContactName: '',
            dropoffContactPhone: '',
            dimensionsLength: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsLength : '',
            dimensionsWidth: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsWidth : '',
            dimensionsHeight: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsHeight : '',
            dimensionsUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsUnit : 'ft',
            dimensionsLengthUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsLengthUnit : 'ft',
            dimensionsWidthUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsWidthUnit : 'in',
            dimensionsHeightUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsHeightUnit : 'in',
            assignedStopIndex: globalStopIndex,
            assignedStopId: dropoffId,
            assignedPickupGroupId: pickupGroupId,
            isExtra: false
          });
        }
      });
    } else {
      allDropoffsMap.forEach(({ pickupGroupId, dropoffId, globalStopIndex }) => {
        const key = `${pickupGroupId}-${dropoffId}`;
        if (!existingCargoKeys.has(key)) {
          const templateCargo = autoCargoItems[0] || cargoItems[0];
          const newId = `cargo-${pickupGroupId}-${dropoffId}-${Date.now()}`;

          cargoToAdd.push({
            id: newId,
            cargoSize: sameCargoForAllStops && templateCargo ? templateCargo.cargoSize : 'small',
            cargoCategory: sameCargoForAllStops && templateCargo ? templateCargo.cargoCategory : 'boxes',
            cargoCategoryCustom: sameCargoForAllStops && templateCargo ? templateCargo.cargoCategoryCustom : '',
            cargoWeight: sameCargoForAllStops && templateCargo ? templateCargo.cargoWeight : '',
            weightUnit: sameCargoForAllStops && templateCargo ? templateCargo.weightUnit : 'kg',
            cargoNotes: sameCargoForAllStops && templateCargo ? templateCargo.cargoNotes : '',
            cargoPhoto: null,
            cargoPhotoPreview: '',
            dropoffLocation: { text: '', lat: 0, lng: 0 },
            dropoffContactName: '',
            dropoffContactPhone: '',
            dimensionsLength: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsLength : '',
            dimensionsWidth: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsWidth : '',
            dimensionsHeight: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsHeight : '',
            dimensionsUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsUnit : 'ft',
            dimensionsLengthUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsLengthUnit : 'ft',
            dimensionsWidthUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsWidthUnit : 'in',
            dimensionsHeightUnit: sameCargoForAllStops && templateCargo ? templateCargo.dimensionsHeightUnit : 'in',
            assignedStopIndex: globalStopIndex,
            assignedStopId: dropoffId,
            assignedPickupGroupId: pickupGroupId,
            isExtra: false
          });
        }
      });

      autoCargoItems.forEach((cargo) => {
        const key = `${cargo.assignedPickupGroupId}-${cargo.assignedStopId}`;
        if (!allDropoffsMap.has(key)) {
          const isEmpty = !cargo.cargoWeight && !cargo.cargoNotes && !cargo.cargoPhoto;
          if (isEmpty) {
            cargoToRemove.push(cargo);
          } else {
            cargoToUpdate.push({
              ...cargo,
              isExtra: true,
              assignedPickupGroupId: undefined
            });
          }
        }
      });
    }

    if (cargoToUpdate.length > 0) {
      setCargoItems(prev => prev.map(item => {
        const updated = cargoToUpdate.find(u => u.id === item.id);
        return updated || item;
      }));
    }

    if (cargoToAdd.length > 0) {
      setCargoItems(prev => [...prev, ...cargoToAdd]);
    }

    if (cargoToRemove.length > 0) {
      const removeIds = new Set(cargoToRemove.map(c => c.id));
      setCargoItems(prev => prev.filter(c => !removeIds.has(c.id)));
    }
  }, [pickupGroups, isMultiStop, hasMultiplePickups, userBusinessType, sameCargoForAllStops, editMode, editDataLoaded]);

  useEffect(() => {
    const isRetailOrHaulage = userBusinessType === 'retail' || userBusinessType === 'haulage';
    if (!isRetailOrHaulage || !isMultiStop || !sameCargoForAllStops || cargoItems.length === 0) return;

    const autoCargoItems = hasMultiplePickups
      ? cargoItems.filter(c => !c.isExtra && c.assignedPickupGroupId)
      : cargoItems.filter(c => !c.isExtra);

    if (autoCargoItems.length === 0) return;

    const templateCargo = autoCargoItems[0];
    const updatedCargo = cargoItems.map((item) => {
      if (item.isExtra) return item;
      if (item.id === templateCargo.id) return item;

      if (hasMultiplePickups && !item.assignedPickupGroupId) return item;
      if (!hasMultiplePickups && item.assignedPickupGroupId) return item;

      return {
        ...item,
        cargoSize: templateCargo.cargoSize,
        cargoCategory: templateCargo.cargoCategory,
        cargoCategoryCustom: templateCargo.cargoCategoryCustom,
        cargoWeight: templateCargo.cargoWeight,
        weightUnit: templateCargo.weightUnit,
        cargoNotes: templateCargo.cargoNotes,
        dimensionsLength: templateCargo.dimensionsLength,
        dimensionsWidth: templateCargo.dimensionsWidth,
        dimensionsHeight: templateCargo.dimensionsHeight,
        dimensionsUnit: templateCargo.dimensionsUnit,
        dimensionsLengthUnit: templateCargo.dimensionsLengthUnit,
        dimensionsWidthUnit: templateCargo.dimensionsWidthUnit,
        dimensionsHeightUnit: templateCargo.dimensionsHeightUnit
      };
    });

    const hasChanges = updatedCargo.some((item, index) => {
      const original = cargoItems[index];
      return item.cargoSize !== original.cargoSize ||
             item.cargoCategory !== original.cargoCategory ||
             item.cargoCategoryCustom !== original.cargoCategoryCustom ||
             item.cargoWeight !== original.cargoWeight ||
             item.weightUnit !== original.weightUnit ||
             item.cargoNotes !== original.cargoNotes ||
             item.dimensionsLength !== original.dimensionsLength ||
             item.dimensionsWidth !== original.dimensionsWidth ||
             item.dimensionsHeight !== original.dimensionsHeight ||
             item.dimensionsUnit !== original.dimensionsUnit;
    });

    if (hasChanges) {
      setCargoItems(updatedCargo);
    }
  }, [cargoItems[0]?.cargoSize, cargoItems[0]?.cargoCategory, cargoItems[0]?.cargoCategoryCustom, cargoItems[0]?.cargoWeight, cargoItems[0]?.weightUnit, cargoItems[0]?.cargoNotes, cargoItems[0]?.dimensionsLength, cargoItems[0]?.dimensionsWidth, cargoItems[0]?.dimensionsHeight, cargoItems[0]?.dimensionsUnit, sameCargoForAllStops, isMultiStop, hasMultiplePickups, userBusinessType]);

  useEffect(() => {
    // Auto-set deliveryOrderType to 'sequential' when multiple dropoffs are detected
    let totalDropoffsCount = 0;

    if (isMultiStop) {
      if (hasMultiplePickups) {
        totalDropoffsCount = pickupGroups.reduce((sum, group) => sum + group.dropoffs.length, 0);
      } else {
        totalDropoffsCount = multiStopDropoffs.length;
      }
    } else {
      totalDropoffsCount = 1;
    }

    // When transitioning from single to multi-dropoff, set to sequential
    if (totalDropoffsCount > 1 && deliveryOrderType !== 'sequential' && deliveryOrderType !== 'flexible') {
      setDeliveryOrderType('sequential');
    }
  }, [isMultiStop, hasMultiplePickups, pickupGroups, multiStopDropoffs]);

  useEffect(() => {
    if (deliveryType === 'scheduled') {
      let hour24 = parseInt(pickupHour);
      if (pickupPeriod === 'PM' && hour24 !== 12) {
        hour24 += 12;
      } else if (pickupPeriod === 'AM' && hour24 === 12) {
        hour24 = 0;
      }
      const timeString = `${hour24.toString().padStart(2, '0')}:${pickupMinute}`;
      setScheduledPickupTime(timeString);
    }
  }, [pickupHour, pickupMinute, pickupPeriod, deliveryType]);

  const calculateDistance = async () => {
    setCalculatingDistance(true);
    setDistance(0);
    setError('');

    if (!mapsLoaded || !window.google) {
      console.warn('Google Maps not loaded, using fallback distance calculation');
      setTimeout(() => {
        const straightLineDistance = calculateHaversineDistance(
          pickup.lat,
          pickup.lng,
          dropoff.lat,
          dropoff.lng
        );
        const estimatedRoadDistance = straightLineDistance * 1.3;
        setDistance(Math.round(estimatedRoadDistance * 10) / 10);
        setCalculatingDistance(false);
      }, 500);
      return;
    }

    const timeout = setTimeout(() => {
      console.warn('Distance Matrix API timed out, using fallback');
      const straightLineDistance = calculateHaversineDistance(
        pickup.lat,
        pickup.lng,
        dropoff.lat,
        dropoff.lng
      );
      const estimatedRoadDistance = straightLineDistance * 1.3;
      setDistance(Math.round(estimatedRoadDistance * 10) / 10);
      setCalculatingDistance(false);
    }, 8000);

    try {
      const service = new google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [{ lat: pickup.lat, lng: pickup.lng }],
          destinations: [{ lat: dropoff.lat, lng: dropoff.lng }],
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
          clearTimeout(timeout);
          setCalculatingDistance(false);

          if (status === 'OK' && response?.rows[0]?.elements[0]?.distance) {
            const distanceInMeters = response.rows[0].elements[0].distance.value;
            const distanceInKm = distanceInMeters / 1000;
            setDistance(Math.round(distanceInKm * 10) / 10);
          } else if (status === 'ZERO_RESULTS') {
            console.warn('No route found, using fallback distance');
            const straightLineDistance = calculateHaversineDistance(
              pickup.lat,
              pickup.lng,
              dropoff.lat,
              dropoff.lng
            );
            const estimatedRoadDistance = straightLineDistance * 1.3;
            setDistance(Math.round(estimatedRoadDistance * 10) / 10);
          } else {
            console.warn(`Distance Matrix API returned status: ${status}, using fallback`);
            const straightLineDistance = calculateHaversineDistance(
              pickup.lat,
              pickup.lng,
              dropoff.lat,
              dropoff.lng
            );
            const estimatedRoadDistance = straightLineDistance * 1.3;
            setDistance(Math.round(estimatedRoadDistance * 10) / 10);
          }
        }
      );
    } catch (err) {
      clearTimeout(timeout);
      console.warn('Distance calculation error, using fallback:', err);
      const straightLineDistance = calculateHaversineDistance(
        pickup.lat,
        pickup.lng,
        dropoff.lat,
        dropoff.lng
      );
      const estimatedRoadDistance = straightLineDistance * 1.3;
      setDistance(Math.round(estimatedRoadDistance * 10) / 10);
      setCalculatingDistance(false);
    }
  };

  const getLargestCargoSize = (): 'small' | 'medium' | 'large' => {
    const sizeValues = { small: 1, medium: 2, large: 3 };
    let largest: 'small' | 'medium' | 'large' = 'small';
    let largestValue = 1;

    cargoItems.forEach(item => {
      if (sizeValues[item.cargoSize] > largestValue) {
        largest = item.cargoSize;
        largestValue = sizeValues[item.cargoSize];
      }
    });

    return largest;
  };

  const getTotalWeight = (): number => {
    return cargoItems.reduce((sum, item) => {
      const w = parseFloat(item.cargoWeight) || 0;
      return sum + (item.weightUnit === 'lbs' ? w * 0.4536 : w);
    }, 0);
  };

  const getStopCount = (): number => {
    if (!isMultiStop) return 1;
    if (hasMultiplePickups) {
      return pickupGroups.reduce((sum, g) => sum + g.dropoffs.filter(d => d.address).length, 0);
    }
    return multiStopDropoffs.filter(d => d.address).length;
  };

  const getTotalVolumeCm3 = (): number => {
    return cargoItems.reduce((sum, item) => {
      const l = parseFloat(item.dimensionsLength) || 0;
      const w = parseFloat(item.dimensionsWidth) || 0;
      const h = parseFloat(item.dimensionsHeight) || 0;
      if (l === 0 || w === 0 || h === 0) return sum;
      const toCm = (val: number, unit: string) => {
        if (unit === 'in') return val * 2.54;
        if (unit === 'ft') return val * 30.48;
        return val;
      };
      const lCm = toCm(l, item.dimensionsLengthUnit || item.dimensionsUnit);
      const wCm = toCm(w, item.dimensionsWidthUnit || item.dimensionsUnit);
      const hCm = toCm(h, item.dimensionsHeightUnit || item.dimensionsUnit);
      return sum + (lCm * wCm * hCm);
    }, 0);
  };

  const fetchRecommendations = async () => {
    try {
      const effectiveDistance = isMultiStop ? multiStopDistance : distance;
      const largestCargoSize = getLargestCargoSize();
      const cargoCount = cargoItems.length;
      const totalWeight = getTotalWeight();
      const numStops = getStopCount();
      const totalVolumeCm3 = getTotalVolumeCm3();
      const parsedValue = parseFloat(declaredCargoValue) || 0;

      const pricing = await calculatePriceRecommendation({
        distanceKm: effectiveDistance,
        cargoSize: largestCargoSize,
        urgencyHours,
        cargoCount,
        totalWeightKg: totalWeight,
        numStops,
        jobType: jobType,
        isFragile,
        requiresHeavyLift,
        needsCover,
        hasSecurityGate,
        totalVolumeCm3,
        declaredCargoValue: parsedValue,
        cargoInsuranceEnabled,
      });
      setPriceRec(pricing);

      if (priceInputMode === 'slider' && (customerOffer === 100 || customerOffer === priceRec?.high || customerOffer === priceRec?.mid)) {
        setCustomerOffer(pricing.high);
      }

      if (customerOffer >= 0) {
        const likelihoodData = await calculateBookingLikelihood({
          distanceKm: effectiveDistance,
          cargoSize: largestCargoSize,
          urgencyHours,
          customerOfferTTD: customerOffer,
          recommendedMidTTD: pricing.mid,
          recommendedLowTTD: pricing.low,
          recommendedHighTTD: pricing.high,
          cargoCount,
          numStops,
          jobType: jobType,
          isFragile,
          requiresHeavyLift,
        });
        setLikelihood(likelihoodData);
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    }
  };

  useEffect(() => {
    if (priceInputMode === 'custom') {
      if (customPriceInput === '') {
        setCustomerOffer(priceRec?.high || 100);
      } else {
        const parsedPrice = parseInt(customPriceInput);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          setCustomerOffer(parsedPrice);
        }
      }
    }
  }, [customPriceInput, priceInputMode, priceRec]);

  useEffect(() => {
    if (priceRec && customerOffer >= 0) {
      const updateLikelihood = async () => {
        try {
          const effectiveDistance = isMultiStop ? multiStopDistance : distance;
          const largestCargoSize = getLargestCargoSize();
          const likelihoodData = await calculateBookingLikelihood({
            distanceKm: effectiveDistance,
            cargoSize: largestCargoSize,
            urgencyHours,
            customerOfferTTD: customerOffer,
            recommendedMidTTD: priceRec.mid,
            recommendedLowTTD: priceRec.low,
            recommendedHighTTD: priceRec.high,
            cargoCount: cargoItems.length,
            numStops: getStopCount(),
            jobType: jobType,
            isFragile,
            requiresHeavyLift,
          });
          setLikelihood(likelihoodData);
        } catch (err) {
          console.error('Error updating likelihood:', err);
        }
      };
      updateLikelihood();
    }
  }, [customerOffer, distance, multiStopDistance, cargoItems, urgencyHours, priceRec, isMultiStop, jobType, isFragile, requiresHeavyLift]);

  const isNormalCustomer = !userBusinessType || (userBusinessType !== 'retail' && userBusinessType !== 'haulage');
  const showJobTypeStep = isNormalCustomer && !checkingPayment;
  const STEP_LOCATIONS = showJobTypeStep ? 2 : 1;
  const STEP_CARGO = showJobTypeStep ? 3 : 2;
  const STEP_PRICING = showJobTypeStep ? 4 : 3;
  const totalSteps = showJobTypeStep ? 4 : 3;

  useEffect(() => {
    if (step === STEP_PRICING && !editMode && user) {
      const key = `moveme_seen_auction_info_${user.id}`;
      if (!localStorage.getItem(key)) {
        const timer = setTimeout(() => setShowAuctionInfo(true), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [step, STEP_PRICING, editMode, user]);

  const handleLocationStep = () => {
    if (isMultiStop) {
      setError('');
      setStep(STEP_CARGO);
      return;
    }

    if (jobType === 'junk_removal' && isNormalCustomer) {
      if (!pickup.text || pickup.lat === 0) {
        setError('Please enter your pickup location');
        return;
      }
      if (calculatingDistance) {
        setError('Please wait while we calculate the distance');
        return;
      }
      if (distance === 0) {
        setError('Unable to calculate distance to landfill. Please check your location.');
        return;
      }
      setError('');
      setStep(STEP_CARGO);
      return;
    }

    if (!pickup.text || !dropoff.text) {
      setError('Please select both pickup and dropoff locations');
      return;
    }
    if (calculatingDistance) {
      setError('Please wait while we calculate the distance');
      return;
    }
    if (distance === 0) {
      setError('Unable to calculate distance. Please check your locations and try again.');
      return;
    }
    setError('');
    setStep(STEP_CARGO);
  };

  const handleCargoStep = () => {
    if (jobType === 'courier' && isNormalCustomer) {
      if (!courierCargoSize) {
        setError('Please select what you are sending');
        return;
      }
      if (!courierRecipientName.trim()) {
        setError('Please enter the recipient\'s name');
        return;
      }
      if (!courierRecipientPhone.trim()) {
        setError('Please enter the recipient\'s phone number');
        return;
      }
      if (!courierSafetyAcknowledged) {
        setError('Please acknowledge the safety & liability terms before proceeding');
        return;
      }
      setError('');
      setStep(STEP_PRICING);
      return;
    }

    if (cargoItems.length === 0) {
      setError('Please add at least one cargo item');
      return;
    }

    if (isMultiStop) {
      const finalPickups = hasMultiplePickups ? pickupGroups.map(g => g.pickup) : multiStopPickups;
      const finalDropoffs = hasMultiplePickups ? pickupGroups.flatMap(g => g.dropoffs) : multiStopDropoffs;

      const validPickups = finalPickups.filter(p => p && p.address && p.lat && p.lng && p.lat !== 0 && p.lng !== 0);
      const validDropoffs = finalDropoffs.filter(d => d && d.address && d.lat && d.lng && d.lat !== 0 && d.lng !== 0);

      if (validPickups.length === 0) {
        setError('Please add at least one pickup location');
        return;
      }
      if (validDropoffs.length < 2) {
        setError('Please add at least two drop-off locations for multi-stop delivery');
        return;
      }
      if (multiStopDistance === 0) {
        setError('Unable to calculate route distance. Please check your locations.');
        return;
      }
    }

    for (const item of cargoItems) {
      if (!item.cargoSize) {
        setError('Please select cargo size for all items');
        return;
      }
      if (item.cargoSize === 'large') {
        if (!item.dimensionsLength || !item.dimensionsWidth || !item.dimensionsHeight) {
          setError('Please provide dimensions (length, width, height) for all large cargo items');
          return;
        }
        if (parseFloat(item.dimensionsLength) <= 0 || parseFloat(item.dimensionsWidth) <= 0 || parseFloat(item.dimensionsHeight) <= 0) {
          setError('Cargo dimensions must be greater than 0');
          return;
        }
      }
      if (item.cargoCategory === 'other' && !item.cargoCategoryCustom.trim()) {
        setError('Please specify the cargo category for all items');
        return;
      }
      if (userBusinessType === 'retail' && hasMultipleDropoffs && !isMultiStop) {
        if (!item.dropoffLocation.text) {
          setError('Please specify delivery address for all items');
          return;
        }
        if (!item.dropoffContactName.trim()) {
          setError('Please specify recipient name for all items');
          return;
        }
        if (!item.dropoffContactPhone.trim()) {
          setError('Please specify recipient phone for all items');
          return;
        }
      }
    }

    if (jobType === 'marketplace_safebuy' && isNormalCustomer) {
      if (!marketplaceSellerContact.trim()) {
        setError('Please enter the seller\'s name');
        return;
      }
      if (!marketplaceSellerPhone.trim()) {
        setError('Please enter the seller\'s phone number');
        return;
      }
      if (!marketplaceItemScreenshot && !marketplaceItemScreenshotPreview) {
        setError('Please upload a screenshot or photo of the item');
        return;
      }
      if (!marketplacePaymentStatus) {
        setError('Please select how the seller is being paid');
        return;
      }
    }

    if (jobType === 'junk_removal' && isNormalCustomer) {
      if (!junkPhotoPreview) {
        setError('Please upload a photo of the junk so the driver brings the right truck');
        return;
      }
      if (junkWasteCategories.length === 0) {
        setError('Please select at least one waste category');
        return;
      }
      if (!junkSafetyAcknowledged) {
        setError('Please acknowledge the safety confirmation before proceeding');
        return;
      }
    }

    setError('');
    setStep(STEP_PRICING);
  };

  const addCargoItem = () => {
    const newId = (parseInt(cargoItems[cargoItems.length - 1]?.id || '0') + 1).toString();
    const newItem: CargoItem = {
      id: newId,
      cargoSize: 'small',
      cargoCategory: 'boxes',
      cargoCategoryCustom: '',
      cargoWeight: '',
      weightUnit: 'kg',
      cargoNotes: '',
      cargoPhoto: null,
      cargoPhotoPreview: '',
      dropoffLocation: { text: '', lat: 0, lng: 0 },
      dropoffContactName: '',
      dropoffContactPhone: '',
      assignedStopIndex: 0,
      assignedStopId: multiStopDropoffs[0]?.id || 'dropoff-1',
      dimensionsLength: '',
      dimensionsWidth: '',
      dimensionsHeight: '',
      dimensionsUnit: 'ft',
      dimensionsLengthUnit: 'ft',
      dimensionsWidthUnit: 'in',
      dimensionsHeightUnit: 'in'
    };
    setCargoItems([...cargoItems, newItem]);
    setExpandedCargoId(newId);
  };

  const addExtraCargoItem = () => {
    const newId = `cargo-extra-${Date.now()}`;
    const newItem: CargoItem = {
      id: newId,
      cargoSize: 'small',
      cargoCategory: 'boxes',
      cargoCategoryCustom: '',
      cargoWeight: '',
      weightUnit: 'kg',
      cargoNotes: '',
      cargoPhoto: null,
      cargoPhotoPreview: '',
      dropoffLocation: { text: '', lat: 0, lng: 0 },
      dropoffContactName: '',
      dropoffContactPhone: '',
      dimensionsLength: '',
      dimensionsWidth: '',
      dimensionsHeight: '',
      dimensionsUnit: 'ft',
      dimensionsLengthUnit: 'ft',
      dimensionsWidthUnit: 'in',
      dimensionsHeightUnit: 'in',
      assignedStopIndex: 0,
      assignedStopId: multiStopDropoffs[0]?.id || 'dropoff-1',
      isExtra: true
    };
    setCargoItems([...cargoItems, newItem]);
    setExpandedCargoId(newId);
  };

  const removeCargoItem = (id: string) => {
    if (cargoItems.length === 1) {
      setError('You must have at least one cargo item');
      return;
    }
    setCargoItems(cargoItems.filter(item => item.id !== id));
    if (expandedCargoId === id) {
      setExpandedCargoId(cargoItems[0]?.id || '');
    }
  };

  const updateCargoItem = (id: string, updates: Partial<CargoItem>) => {
    setCargoItems(cargoItems.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const handlePhotoSelect = (cargoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('File must be an image');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      updateCargoItem(cargoId, {
        cargoPhoto: file,
        cargoPhotoPreview: reader.result as string
      });
    };
    reader.readAsDataURL(file);
    setError('');
  };

  const handleRemovePhoto = (cargoId: string) => {
    updateCargoItem(cargoId, {
      cargoPhoto: null,
      cargoPhotoPreview: ''
    });
  };

  const uploadCargoPhoto = async (photo: File): Promise<string | null> => {
    if (!photo || !user) return null;

    try {
      const fileExt = photo.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('cargo-photos')
        .upload(fileName, photo, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cargo-photos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (err) {
      console.error('Error uploading photo:', err);
      return null;
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!hasPaymentInfo) {
      setShowPaymentModal(true);
      return;
    }

    if (customerOffer <= 0) {
      setError('Please enter a valid price greater than $0');
      return;
    }

    if (customerOffer < 10) {
      setError('Price must be at least $10 TTD');
      return;
    }

    if (cashToReturn && (!cashToReturnAmount || parseFloat(cashToReturnAmount) <= 0)) {
      setError('Please enter the cash amount to be collected from the recipient');
      return;
    }

    if (deliveryType === 'scheduled') {
      if (!scheduledPickupDate || !scheduledPickupTime) {
        setError('Please select pickup date and time');
        return;
      }
    }

    if (userBusinessType === 'retail') {
      if (!isMultiStop) {
        if (!pickup.text || pickup.lat === 0 || pickup.lng === 0) {
          setError('Please enter a valid pickup location');
          return;
        }
        if (!dropoff.text || dropoff.lat === 0 || dropoff.lng === 0) {
          setError('Please enter a valid dropoff location');
          return;
        }
      } else {
        const finalPickups = hasMultiplePickups ? pickupGroups.map(g => g.pickup) : multiStopPickups;
        const finalDropoffs = hasMultiplePickups ? pickupGroups.flatMap(g => g.dropoffs) : multiStopDropoffs;

        const validPickups = finalPickups.filter(p => p && p.address && p.lat && p.lng && p.lat !== 0 && p.lng !== 0);
        const validDropoffs = finalDropoffs.filter(d => d && d.address && d.lat && d.lng && d.lat !== 0 && d.lng !== 0);

        if (validPickups.length === 0) {
          setError('Please add at least one pickup location');
          return;
        }
        if (validDropoffs.length === 0) {
          setError('Please add at least one drop-off location');
          return;
        }
      }

      if (cargoItems.length === 0) {
        setError('Please add at least one cargo item');
        return;
      }

      const validProofValues = ['PHOTO', 'SIGNATURE', 'PHOTO_AND_SIGNATURE', 'NONE'];
      if (!validProofValues.includes(proofOfDelivery)) {
        setError('Invalid proof of delivery option selected');
        return;
      }
    }

    setLoading(true);
    setUploadingPhoto(true);

    try {
      let scheduledPickupTimestamp = null;
      let scheduledDropoffTimestamp = null;

      if (deliveryType === 'scheduled') {
        scheduledPickupTimestamp = new Date(`${scheduledPickupDate}T${scheduledPickupTime}`).toISOString();
      }

      const paymentBreakdown = calculatePaymentBreakdown(customerOffer, platformFeePercent);
      const customerFees = calculateCustomerFees(customerOffer, platformFeePercent);
      const largestCargoSize = getLargestCargoSize();

      const isJunkJob = jobType === 'junk_removal' && isNormalCustomer;
      const junkNotOnCurbFee = isJunkJob && !junkCurbside ? JUNK_NOT_ON_CURB_FEE : 0;
      const junkExtraHandFee = isJunkJob && junkNeedExtraHand ? JUNK_EXTRA_HAND_FEE : 0;
      const junkTipFee = isJunkJob ? JUNK_TIPPING_FEE : 0;
      const junkExtrasTotal = junkNotOnCurbFee + junkExtraHandFee + junkTipFee;

      const useMergedMode = isMultiStop && hasMultiplePickups && (userBusinessType === 'retail' || userBusinessType === 'haulage');

      let finalPickups: RouteLocation[] = [];
      let finalDropoffs: RouteLocation[] = [];

      if (useMergedMode) {
        finalPickups = pickupGroups.map(g => g.pickup);
        finalDropoffs = pickupGroups.flatMap(g => g.dropoffs);
      } else if (isMultiStop) {
        finalPickups = multiStopPickups;
        finalDropoffs = multiStopDropoffs;
      }

      const jobInsertData: any = {
        customer_user_id: user!.id,
        pickup_location_text: isMultiStop ? finalPickups[0]?.address || '' : pickup.text,
        dropoff_location_text: isMultiStop ? finalDropoffs[0]?.address || '' : dropoff.text,
        pickup_lat: isMultiStop ? finalPickups[0]?.lat || 0 : pickup.lat,
        pickup_lng: isMultiStop ? finalPickups[0]?.lng || 0 : pickup.lng,
        dropoff_lat: isMultiStop ? finalDropoffs[0]?.lat || 0 : dropoff.lat,
        dropoff_lng: isMultiStop ? finalDropoffs[0]?.lng || 0 : dropoff.lng,
        distance_km: isMultiStop ? multiStopDistance : distance,
        is_multi_stop: isMultiStop,
        has_multiple_pickups: hasMultiplePickups,
        total_distance_km: isMultiStop ? multiStopDistance : null,
        eta_minutes: isMultiStop ? multiStopEta : null,
        cargo_size_category: largestCargoSize,
        cargo_category: cargoItems[0].cargoCategory,
        cargo_category_custom: cargoItems[0].cargoCategory === 'other' ? cargoItems[0].cargoCategoryCustom : null,
        cargo_weight_kg: cargoItems[0].cargoWeight ? (cargoItems[0].weightUnit === 'lbs' ? parseFloat(cargoItems[0].cargoWeight) * 0.453592 : parseFloat(cargoItems[0].cargoWeight)) : null,
        cargo_photo_url: null,
        cargo_notes: cargoItems[0].cargoNotes,
        is_fragile: isFragile,
        needs_cover: needsCover,
        requires_heavy_lift: requiresHeavyLift,
        has_security_gate: hasSecurityGate,
        special_requirements_notes: specialRequirementsNotes || null,
        delivery_type: deliveryType,
        scheduled_pickup_time: scheduledPickupTimestamp,
        scheduled_dropoff_time: scheduledDropoffTimestamp,
        urgency_hours: deliveryType === 'asap' ? 0 : null,
        pricing_type: pricingType,
        is_open_to_bids: pricingType === 'bid',
        customer_offer_ttd: customerOffer,
        base_price: paymentBreakdown.basePrice,
        platform_fee: paymentBreakdown.platformFee,
        vat_amount: paymentBreakdown.vatAmount,
        total_price: Math.round((paymentBreakdown.totalPrice + insuranceFee + junkExtrasTotal) * 100) / 100,
        courier_earnings: paymentBreakdown.courierEarnings,
        customer_service_fee: Math.round((customerFees.platformFee + customerFees.vatAmount) * 100) / 100,
        customer_total: Math.round((customerFees.customerTotal + insuranceFee + junkExtrasTotal) * 100) / 100,
        driver_platform_fee: Math.round(customerOffer * platformFeePercent * 100) / 100,
        driver_net_earnings: Math.round((customerOffer * (1 - platformFeePercent) + junkExtrasTotal) * 100) / 100,
        platform_revenue: Math.round(customerOffer * platformFeePercent * 2 * 100) / 100,
        recommended_low_ttd: priceRec?.low || 0,
        recommended_mid_ttd: priceRec?.mid || 0,
        recommended_high_ttd: priceRec?.high || 0,
        likelihood_score: likelihood?.score || 0,
        likelihood_label: likelihood?.label || '',
        status: pricingType === 'bid' ? 'bidding' : 'open',
        cash_to_return: cashToReturn,
        cash_to_return_amount: cashToReturn && cashToReturnAmount ? parseFloat(cashToReturnAmount) : 0,
        cash_collection_status: cashToReturn ? 'pending' : 'none',
        declared_cargo_value: parsedCargoValue,
        cargo_insurance_enabled: cargoInsuranceEnabled,
        cargo_insurance_fee: insuranceFee,
        is_high_value: isHighValue,
      };

      jobInsertData.proof_of_delivery_required = proofOfDelivery || 'NONE';
      jobInsertData.job_type = isNormalCustomer ? jobType : 'standard';

      if (userBusinessType === 'retail' && sendToPreferredFirst && hasPreferredCouriers) {
        jobInsertData.job_visibility = 'preferred_preview';
        jobInsertData.preferred_dispatch_expires_at = getPreferredDispatchExpiry();
        jobInsertData.send_to_preferred_first = true;
      } else {
        jobInsertData.job_visibility = 'public';
        jobInsertData.send_to_preferred_first = false;
      }

      if (jobType === 'marketplace_safebuy' && isNormalCustomer) {
        jobInsertData.marketplace_seller_contact = marketplaceSellerContact
          ? `${marketplaceSellerContact} - ${marketplaceSellerPhone}`
          : null;
        jobInsertData.marketplace_listing_url = marketplaceListingUrl || null;
        jobInsertData.marketplace_max_budget = marketplaceMaxBudget ? parseFloat(marketplaceMaxBudget) : null;
        jobInsertData.marketplace_inspection_instructions = marketplaceInspectionInstructions || null;
        jobInsertData.marketplace_payment_status = marketplacePaymentStatus || null;
        jobInsertData.marketplace_inspection_status = 'pending_inspection';
        jobInsertData.marketplace_require_inspection_photo = marketplaceRequirePhoto;

        if (marketplaceItemScreenshot) {
          const fileExt = marketplaceItemScreenshot.name.split('.').pop();
          const filePath = `${user!.id}/item-${Date.now()}.${fileExt}`;
          const { error: uploadErr } = await supabase.storage
            .from('marketplace-photos')
            .upload(filePath, marketplaceItemScreenshot);
          if (!uploadErr) {
            const { data: urlData } = supabase.storage
              .from('marketplace-photos')
              .getPublicUrl(filePath);
            jobInsertData.marketplace_item_screenshot_url = urlData.publicUrl;
          }
        }
      }
      if (jobType === 'junk_removal' && isNormalCustomer) {
        jobInsertData.junk_disposal_type = junkDisposalType || null;
        jobInsertData.junk_tipping_fee_included = true;
        jobInsertData.junk_waste_categories = junkWasteCategories;
        jobInsertData.junk_safety_acknowledged = junkSafetyAcknowledged;
        jobInsertData.junk_curbside = junkCurbside;
        jobInsertData.junk_need_extra_hand = junkNeedExtraHand;
        jobInsertData.junk_heavy_lifting_fee = junkNotOnCurbFee;
        jobInsertData.junk_extra_hand_fee = junkExtraHandFee;
        jobInsertData.junk_tipping_fee = junkTipFee;
        jobInsertData.junk_landfill_name = dropoff.text || null;
      }

      if (jobType === 'courier' && isNormalCustomer) {
        const courierSizeMap: Record<string, 'small' | 'medium'> = { envelope: 'small', small_parcel: 'small', medium_box: 'medium' };
        jobInsertData.cargo_size_category = courierSizeMap[courierCargoSize || 'small_parcel'] || 'small';
        jobInsertData.cargo_category = 'boxes';
        jobInsertData.cargo_notes = `Courier: ${courierCargoSize === 'envelope' ? 'Envelope' : courierCargoSize === 'small_parcel' ? 'Small Parcel' : 'Medium Box'}`;
        jobInsertData.courier_cargo_size = courierCargoSize;
        jobInsertData.courier_urgency = 'standard';
        jobInsertData.courier_recipient_name = courierRecipientName;
        jobInsertData.courier_recipient_phone = courierRecipientPhone;
        jobInsertData.courier_building_details = courierBuildingDetails || null;
        jobInsertData.courier_require_signature = courierRequireSignature;
        jobInsertData.courier_safety_acknowledged = courierSafetyAcknowledged;
        jobInsertData.courier_express_multiplier = 1.0;
      }

      // Calculate total dropoffs count and set delivery_order_type only for multi-dropoff jobs
      let totalDropoffsCount = 0;
      if (isMultiStop) {
        if (hasMultiplePickups) {
          totalDropoffsCount = pickupGroups.reduce((sum, group) => sum + group.dropoffs.length, 0);
        } else {
          totalDropoffsCount = multiStopDropoffs.length;
        }
      } else {
        totalDropoffsCount = 1;
      }

      // Only set delivery_order_type and route_type for jobs with multiple dropoffs
      if (totalDropoffsCount > 1) {
        jobInsertData.delivery_order_type = deliveryOrderType;
        jobInsertData.route_type = deliveryOrderType === 'flexible' ? 'FLEXIBLE' : 'FIXED';
      } else {
        jobInsertData.delivery_order_type = null;
        jobInsertData.route_type = null;
      }

      if (isMultiStop) {
        if (useMergedMode) {
          jobInsertData.pickups = JSON.stringify(finalPickups.map((p, pickupIdx) => ({
            id: p.id,
            address: p.address,
            lat: p.lat,
            lng: p.lng,
            label: `Pickup ${pickupIdx + 1}`
          })));

          let globalDropoffIndex = 0;
          jobInsertData.dropoffs = JSON.stringify(
            pickupGroups.flatMap((group, pickupIdx) =>
              group.dropoffs.map((d, localDropoffIdx) => {
                const dropoffData = {
                  id: d.id,
                  address: d.address,
                  lat: d.lat,
                  lng: d.lng,
                  label: `P${pickupIdx + 1} Stop ${localDropoffIdx + 1}`,
                  orderIndex: globalDropoffIndex++
                };
                return dropoffData;
              })
            )
          );
        } else {
          jobInsertData.pickups = JSON.stringify(finalPickups.map((p, pickupIdx) => ({
            id: p.id,
            address: p.address,
            lat: p.lat,
            lng: p.lng,
            label: hasMultiplePickups ? `Pickup ${pickupIdx + 1}` : 'Pickup'
          })));
          jobInsertData.dropoffs = JSON.stringify(finalDropoffs.map((d, index) => ({
            id: d.id,
            address: d.address,
            lat: d.lat,
            lng: d.lng,
            label: `Stop ${index + 1}`,
            orderIndex: index
          })));
        }
      }

      let jobData;

      if (editMode && editJobId) {
        const { data: updatedJob, error: updateError } = await supabase
          .from('jobs')
          .update({
            ...jobInsertData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editJobId)
          .select()
          .single();

        if (updateError) throw updateError;
        jobData = updatedJob;

        const { error: deleteCargoError } = await supabase
          .from('cargo_items')
          .delete()
          .eq('job_id', editJobId);

        if (deleteCargoError) throw deleteCargoError;

        // Delete existing delivery_stops for this job
        const { error: deleteStopsError } = await supabase
          .from('delivery_stops')
          .delete()
          .eq('job_id', editJobId);

        if (deleteStopsError) {
          console.error('Failed to delete old delivery_stops:', deleteStopsError);
        }
      } else {
        const { data: newJob, error: insertError } = await supabase
          .from('jobs')
          .insert(jobInsertData)
          .select()
          .single();

        if (insertError) throw insertError;
        jobData = newJob;
      }

      if (jobType === 'junk_removal' && junkPhoto && jobData) {
        const junkPhotoUrl = await uploadCargoPhoto(junkPhoto);
        if (junkPhotoUrl) {
          await supabase.from('jobs').update({ junk_photo_url: junkPhotoUrl }).eq('id', jobData.id);
        }
      }

      const podStatus = proofOfDelivery === 'NONE' ? 'NOT_REQUIRED' : 'REQUIRED';
      const { error: podError } = await supabase
        .from('proof_of_delivery')
        .upsert({
          job_id: jobData.id,
          required_type: proofOfDelivery,
          status: podStatus,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'job_id'
        });

      if (podError) {
        console.error('Failed to upsert POD record:', podError);
      }

      // Create delivery_stops records for multi-stop jobs (both new and edited)
      if (isMultiStop && jobData && (finalPickups.length > 0 || finalDropoffs.length > 0)) {
        const actionVerb = editMode ? 'Recreating' : 'Creating';
        console.log(`${actionVerb} delivery_stops for job ${jobData.id}: ${finalPickups.length} pickups, ${finalDropoffs.length} dropoffs`);

        const stopsToInsert = [
          ...finalPickups.map((pickup, idx) => ({
            job_id: jobData.id,
            stop_index: idx,
            stop_type: 'PICKUP' as const,
            location_text: pickup.address,
            location_lat: pickup.lat,
            location_lng: pickup.lng,
            status: 'NOT_STARTED' as const
          })),
          ...finalDropoffs.map((dropoff, idx) => ({
            job_id: jobData.id,
            stop_index: finalPickups.length + idx,
            stop_type: 'DROPOFF' as const,
            location_text: dropoff.address,
            location_lat: dropoff.lat,
            location_lng: dropoff.lng,
            status: 'NOT_STARTED' as const
          }))
        ];

        const { data: insertedStops, error: stopsError } = await supabase
          .from('delivery_stops')
          .insert(stopsToInsert)
          .select();

        if (stopsError) {
          console.error('Failed to create delivery_stops:', stopsError);
        } else {
          console.log(`✅ Created ${insertedStops?.length || 0} delivery_stops records`);

          // Create POD stops for dropoffs if POD is required
          if (proofOfDelivery !== 'NONE' && insertedStops) {
            const dropoffStops = insertedStops.filter(s => s.stop_type === 'DROPOFF');
            if (dropoffStops.length > 0) {
              const podStopsToInsert = dropoffStops.map(stop => ({
                stop_id: stop.id,
                job_id: jobData.id,
                required_type: proofOfDelivery,
                status: 'REQUIRED' as const
              }));

              const { data: insertedPODs, error: podStopsError } = await supabase
                .from('pod_stops')
                .insert(podStopsToInsert)
                .select();

              if (podStopsError) {
                console.error('Failed to create POD stops:', podStopsError);
              } else {
                console.log(`✅ Created ${insertedPODs?.length || 0} POD stop records`);
              }
            }
          }
        }
      }

      for (const cargoItem of cargoItems) {
        let cargoPhotoUrl = null;
        if (cargoItem.cargoPhoto) {
          cargoPhotoUrl = await uploadCargoPhoto(cargoItem.cargoPhoto);
        } else if (cargoItem.cargoPhotoPreview && cargoItem.cargoPhotoPreview.startsWith('http')) {
          cargoPhotoUrl = cargoItem.cargoPhotoPreview;
        }

        const weightInKg = cargoItem.cargoWeight
          ? cargoItem.weightUnit === 'lbs'
            ? parseFloat(cargoItem.cargoWeight) * 0.453592
            : parseFloat(cargoItem.cargoWeight)
          : null;

        const cargoItemData: any = {
          job_id: jobData.id,
          cargo_size_category: cargoItem.cargoSize,
          cargo_category: cargoItem.cargoCategory,
          cargo_category_custom: cargoItem.cargoCategory === 'other' ? cargoItem.cargoCategoryCustom : null,
          cargo_weight_kg: weightInKg,
          cargo_photo_url: cargoPhotoUrl,
          cargo_notes: cargoItem.cargoNotes,
          dimensions_length: cargoItem.dimensionsLength ? parseFloat(cargoItem.dimensionsLength) : null,
          dimensions_width: cargoItem.dimensionsWidth ? parseFloat(cargoItem.dimensionsWidth) : null,
          dimensions_height: cargoItem.dimensionsHeight ? parseFloat(cargoItem.dimensionsHeight) : null,
          dimensions_unit: cargoItem.dimensionsUnit || 'ft',
          dimensions_length_unit: cargoItem.dimensionsLengthUnit || 'ft',
          dimensions_width_unit: cargoItem.dimensionsWidthUnit || 'in',
          dimensions_height_unit: cargoItem.dimensionsHeightUnit || 'in',
        };

        if (isMultiStop) {
          cargoItemData.assigned_stop_index = cargoItem.assignedStopIndex;
          cargoItemData.assigned_stop_id = cargoItem.assignedStopId;
        } else if (userBusinessType === 'retail' && hasMultipleDropoffs && cargoItem.dropoffLocation.text) {
          cargoItemData.dropoff_location_text = cargoItem.dropoffLocation.text;
          cargoItemData.dropoff_lat = cargoItem.dropoffLocation.lat;
          cargoItemData.dropoff_lng = cargoItem.dropoffLocation.lng;
          cargoItemData.dropoff_contact_name = cargoItem.dropoffContactName;
          cargoItemData.dropoff_contact_phone = cargoItem.dropoffContactPhone;
        }

        const { error: cargoError } = await supabase
          .from('cargo_items')
          .insert(cargoItemData);

        if (cargoError) throw cargoError;
      }

      if (!editMode && user) {
        const addressesToSave: { address_text: string; lat: number; lng: number }[] = [];
        if (!isMultiStop && pickup.text && pickup.lat !== 0) {
          addressesToSave.push({ address_text: pickup.text, lat: pickup.lat, lng: pickup.lng });
        }
        if (!isMultiStop && dropoff.text && dropoff.lat !== 0) {
          addressesToSave.push({ address_text: dropoff.text, lat: dropoff.lat, lng: dropoff.lng });
        }

        for (const addr of addressesToSave) {
          const { data: existing } = await supabase
            .from('saved_addresses')
            .select('id')
            .eq('user_id', user.id)
            .eq('address_text', addr.address_text)
            .maybeSingle();

          if (!existing) {
            await supabase.from('saved_addresses').insert({
              user_id: user.id,
              label: addr.address_text.split(',')[0].trim(),
              address_text: addr.address_text,
              lat: addr.lat,
              lng: addr.lng,
            });
          }
        }
      }

      if (editMode) {
        setSuccessMessage('Job Updated Successfully! Your changes have been saved.');
      } else {
        setSuccessMessage(`Job Posted Successfully! Your delivery job is now live. Truckers can view and ${pricingType === 'bid' ? 'bid on' : 'accept'} your job.`);
      }
      setShowSuccessNotification(true);

      setTimeout(() => {
        onJobCreated();
      }, 2000);
    } catch (err: unknown) {
      console.error('Job creation error:', err);

      if (userBusinessType === 'retail') {
        console.log('Job Insert Payload:', JSON.stringify({
          ...jobInsertData,
          customer_user_id: '[USER_ID]',
        }, null, 2));
      }

      let errorMessage = 'An error occurred while creating job';
      let errorDetails = '';

      if (err && typeof err === 'object') {
        const error = err as any;

        if (error.message) {
          errorMessage = `Job creation failed: ${error.message}`;
        }

        if (userBusinessType === 'retail') {
          if (error.details) {
            errorDetails = `\n\nDetails: ${error.details}`;
          }
          if (error.hint) {
            errorDetails += `\n\nHint: ${error.hint}`;
          }
          if (error.code) {
            errorDetails += `\n\nError Code: ${error.code}`;
          }
        }
      }

      setError(errorMessage + errorDetails);
    } finally {
      setLoading(false);
      setUploadingPhoto(false);
    }
  };

  if (loadingJobData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (editMode && error && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Unable to Edit Job</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={onBack}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Back to Job Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-3 sm:px-4">
      {showAuctionInfo && user && <AuctionInfoPopup userId={user.id} onDismiss={() => setShowAuctionInfo(false)} />}
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">{editMode ? 'Edit Delivery Job' : 'Create Delivery Job'}</h1>

          <div className="flex items-center gap-2 mb-6">
            {(showJobTypeStep
              ? ['Job Type', 'Pickup & Dropoff', 'Cargo Details', 'Job Summary']
              : ['Pickup & Dropoff', 'Cargo Details', 'Job Summary']
            ).map((label, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className={`w-full h-1.5 rounded-full transition-colors duration-300 ${step >= i + 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <span className={`text-[10px] font-medium tracking-wide transition-colors duration-300 ${step >= i + 1 ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {step === 1 && showJobTypeStep && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <JobTypeSelector
              selectedType={jobType}
              onSelect={setJobType}
              onContinue={() => {
                setError('');
                setStep(STEP_LOCATIONS);
              }}
            />
          </div>
        )}

        {step === STEP_LOCATIONS && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6">Pickup & Dropoff</h2>

            <div className="space-y-6">
              {(userBusinessType === 'retail' || userBusinessType === 'haulage') && (
                <div className="border-2 border-blue-200 rounded-xl overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isMultiStop}
                        onChange={(e) => setIsMultiStop(e.target.checked)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-blue-600" />
                          <span className="font-semibold text-gray-900">Multiple delivery locations (multi-stop route)</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Plan a route with multiple drop-offs (and optional multiple pickups).
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {!isMultiStop && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Pickup Location
                      </label>
                      <div className="flex items-center gap-3">
                        {pickup.text && pickup.lat !== 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSaveAddressData({ address: pickup.text, lat: pickup.lat, lng: pickup.lng });
                              setSaveAddressLabel(pickup.text.split(',')[0].trim());
                              setShowSaveAddressModal(true);
                            }}
                            className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save address
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSavedAddressTarget('pickup');
                            setShowSavedAddressPicker(true);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          Use saved address
                        </button>
                      </div>
                    </div>
                    <GooglePlacesAutocomplete
                      value={pickup.text}
                      onChange={(text, lat, lng) => setPickup({ text, lat, lng })}
                      placeholder="Enter pickup location"
                    />
                  </div>

                  {jobType === 'junk_removal' && isNormalCustomer ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Trash2 className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-900">Dropoff auto-set to nearest landfill</p>
                          {dropoff.text ? (
                            <p className="text-sm text-amber-700 mt-1">{dropoff.text}</p>
                          ) : (
                            <p className="text-xs text-amber-600 mt-1">Enter your pickup location above and we'll find the closest official landfill.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Dropoff Location
                        </label>
                        <div className="flex items-center gap-3">
                          {dropoff.text && dropoff.lat !== 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSaveAddressData({ address: dropoff.text, lat: dropoff.lat, lng: dropoff.lng });
                                setSaveAddressLabel(dropoff.text.split(',')[0].trim());
                                setShowSaveAddressModal(true);
                              }}
                              className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Save address
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSavedAddressTarget('dropoff');
                              setShowSavedAddressPicker(true);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            <BookmarkPlus className="w-3.5 h-3.5" />
                            Use saved address
                          </button>
                        </div>
                      </div>
                      <GooglePlacesAutocomplete
                        value={dropoff.text}
                        onChange={(text, lat, lng) => setDropoff({ text, lat, lng })}
                        placeholder="Enter dropoff location"
                      />
                    </div>
                  )}
                </div>
              )}

              {isMultiStop && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-700">
                      <p className="font-semibold text-gray-900 mb-1">Multi-Stop Mode Enabled</p>
                      <p className="text-xs">
                        You'll configure your pickup and drop-off locations in the next step with an interactive route planner.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!isMultiStop && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Or Drop Pins on Map</h3>
                  <LocationMapPicker
                    pickupLat={pickup.lat}
                    pickupLng={pickup.lng}
                    dropoffLat={dropoff.lat}
                    dropoffLng={dropoff.lng}
                    onPickupChange={(text, lat, lng) => setPickup({ text, lat, lng })}
                    onDropoffChange={(text, lat, lng) => setDropoff({ text, lat, lng })}
                    mapsLoaded={mapsLoaded}
                  />
                </div>
              )}

              {!isMultiStop && calculatingDistance && (
                <div className="p-6 bg-moveme-blue-50 border-2 border-blue-200 rounded-lg">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Truck className="w-6 h-6 text-blue-600 animate-bounce" />
                    <p className="text-sm font-semibold text-blue-900">Calculating distance... Please wait</p>
                  </div>
                  <div className="relative w-full h-3 bg-white rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-green-500 to-blue-500 animate-pulse"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-[shimmer_2s_infinite]"
                         style={{ backgroundSize: '200% 100%' }}></div>
                  </div>
                </div>
              )}

              {!isMultiStop && !calculatingDistance && distance > 0 && (
                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-gray-700">
                      Distance: <span className="font-bold text-green-700">{distance} km</span>
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleLocationStep}
                disabled={calculatingDistance}
                className="w-full py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {calculatingDistance ? 'Calculating...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {step === STEP_CARGO && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            {isMultiStop && (
              <div className="mb-8">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6">Route Planning</h2>
                <RouteMapPlanner
                  pickups={multiStopPickups}
                  dropoffs={multiStopDropoffs}
                  hasMultiplePickups={hasMultiplePickups}
                  onPickupsChange={setMultiStopPickups}
                  onDropoffsChange={setMultiStopDropoffs}
                  onMultiplePickupsToggle={setHasMultiplePickups}
                  onDistanceChange={(distanceKm, etaMinutes) => {
                    setMultiStopDistance(distanceKm);
                    setMultiStopEta(etaMinutes);
                  }}
                  useMergedMode={(userBusinessType === 'retail' || userBusinessType === 'haulage') && hasMultiplePickups}
                  pickupGroups={pickupGroups}
                  onPickupGroupsChange={setPickupGroups}
                  showMultiplePickupsToggle={userBusinessType === 'retail' || userBusinessType === 'haulage'}
                  mapsLoaded={mapsLoaded}
                />

                {multiStopDistance > 0 && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-gray-900">Total Route Distance:</span>
                      </div>
                      <span className="text-2xl font-bold text-green-700">{multiStopDistance} km</span>
                    </div>
                    {multiStopEta > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        Estimated Time: <span className="font-semibold">{formatMinutesToHoursMinutes(multiStopEta)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 border-t-2 border-gray-200 pt-6"></div>
              </div>
            )}

            {jobType === 'junk_removal' && isNormalCustomer && (
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Junk Removal</h2>
            )}

            {jobType === 'courier' && isNormalCustomer && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Courier & Errands</h2>
                    <p className="text-xs text-gray-500">Quick pickup and drop-off for small items</p>
                  </div>
                </div>

                <CourierCargoSelector
                  selected={courierCargoSize}
                  onSelect={setCourierCargoSize}
                />

                <div className="border-t border-gray-100 pt-5">
                  <CourierHandoverForm
                    recipientName={courierRecipientName}
                    recipientPhone={courierRecipientPhone}
                    buildingDetails={courierBuildingDetails}
                    requireSignature={courierRequireSignature}
                    onRecipientNameChange={setCourierRecipientName}
                    onRecipientPhoneChange={setCourierRecipientPhone}
                    onBuildingDetailsChange={setCourierBuildingDetails}
                    onRequireSignatureChange={setCourierRequireSignature}
                  />
                </div>

                <div className="border-t border-gray-100 pt-5">
                  <CourierSafetyCheckbox
                    acknowledged={courierSafetyAcknowledged}
                    onAcknowledgeChange={setCourierSafetyAcknowledged}
                  />
                </div>
              </div>
            )}

            {!((jobType === 'junk_removal' || jobType === 'marketplace_safebuy' || jobType === 'courier') && isNormalCustomer) && (<>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Cargo Details</h2>
              <div className="flex items-center gap-3">
                {(userBusinessType === 'retail' || userBusinessType === 'haulage') && isMultiStop && (
                  <button
                    onClick={addExtraCargoItem}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-all"
                  >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">Add additional cargo</span>
                  </button>
                )}
                {!((userBusinessType === 'retail' || userBusinessType === 'haulage') && isMultiStop) && (
                  <button
                    onClick={addCargoItem}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-all"
                  >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">Add Cargo Item</span>
                  </button>
                )}
              </div>
            </div>

            {(userBusinessType === 'retail' || userBusinessType === 'haulage') && isMultiStop && (
              <div className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameCargoForAllStops}
                    onChange={(e) => setSameCargoForAllStops(e.target.checked)}
                    className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-emerald-600" />
                      <span className="font-semibold text-gray-900">Same cargo for all stops?</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Use the first cargo item as a template and auto-fill the rest
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {cargoItems.map((item, index) => {
                const Icon = {
                  furniture: Sofa,
                  electronics: Laptop,
                  vehicles: Car,
                  equipment: Wrench,
                  pallets: Layers,
                  boxes: Box,
                  other: FileQuestion,
                }[item.cargoCategory];
                const isExpanded = expandedCargoId === item.id;
                const isRetailOrHaulage = userBusinessType === 'retail' || userBusinessType === 'haulage';
                const autoCargoItems = cargoItems.filter(c => !c.isExtra);
                const isFirstAutoCargo = autoCargoItems.length > 0 && autoCargoItems[0].id === item.id;
                const isInheritedCargo = !item.isExtra && isRetailOrHaulage && isMultiStop && sameCargoForAllStops && !isFirstAutoCargo;

                const pickupGroupIndex = item.assignedPickupGroupId ? pickupGroups.findIndex(g => g.id === item.assignedPickupGroupId) : -1;
                const pickupNumber = pickupGroupIndex >= 0 ? pickupGroupIndex + 1 : null;

                let stopNumber: number | null = null;
                if (isRetailOrHaulage && isMultiStop && hasMultiplePickups && item.assignedPickupGroupId) {
                  let globalStopCounter = 1;
                  for (const group of pickupGroups) {
                    for (const dropoff of group.dropoffs) {
                      if (group.id === item.assignedPickupGroupId && dropoff.id === item.assignedStopId) {
                        stopNumber = globalStopCounter;
                        break;
                      }
                      globalStopCounter++;
                    }
                    if (stopNumber !== null) break;
                  }
                } else if (isRetailOrHaulage && isMultiStop && !hasMultiplePickups) {
                  const stopIndex = multiStopDropoffs.findIndex(d => d.id === item.assignedStopId);
                  stopNumber = stopIndex >= 0 ? stopIndex + 1 : null;
                }

                return (
                  <div key={item.id} className="border-2 border-gray-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedCargoId(isExpanded ? '' : item.id)}
                      className="w-full p-4 bg-gradient-to-r from-blue-50 to-slate-50 hover:from-blue-100 hover:to-slate-100 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">
                              Cargo Item {index + 1}
                            </p>
                            {item.isExtra && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                                <Plus className="w-3 h-3" />
                                Extra
                              </span>
                            )}
                            {isRetailOrHaulage && isMultiStop && hasMultiplePickups && pickupNumber !== null && !item.isExtra && (
                              <>
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  Pickup P{pickupNumber}
                                </span>
                                {stopNumber !== null && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                    Stop {stopNumber}
                                  </span>
                                )}
                              </>
                            )}
                            {isRetailOrHaulage && isMultiStop && !hasMultiplePickups && stopNumber !== null && !item.isExtra && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                Stop {stopNumber}
                              </span>
                            )}
                            {isInheritedCargo && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full flex items-center gap-1">
                                <Layers className="w-3 h-3" />
                                Inherited
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">
                            {item.cargoSize && item.cargoCategory
                              ? `${item.cargoSize.charAt(0).toUpperCase() + item.cargoSize.slice(1)} - ${
                                  item.cargoCategory === 'other'
                                    ? item.cargoCategoryCustom || 'Other'
                                    : item.cargoCategory.charAt(0).toUpperCase() + item.cargoCategory.slice(1)
                                }`
                              : 'Not configured'}
                          </p>
                          {item.cargoSize === 'large' && (
                            <p className="text-xs mt-1">
                              {item.dimensionsLength && item.dimensionsWidth && item.dimensionsHeight ? (
                                <span className="text-blue-600 font-medium">
                                  Dims: {item.dimensionsLength}×{item.dimensionsWidth}×{item.dimensionsHeight} {item.dimensionsUnit}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                                  Dimensions required
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cargoItems.length > 1 && !isInheritedCargo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCargoItem(item.id);
                            }}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 sm:p-4 bg-white space-y-5 sm:space-y-6 border-t border-gray-200">
                        {isInheritedCargo && (
                          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-emerald-800">
                              <Layers className="w-5 h-5" />
                              <p className="text-sm font-semibold">
                                This cargo inherits all details from Cargo Item 1
                              </p>
                            </div>
                            <p className="text-xs text-emerald-700 mt-1">
                              To edit, uncheck "Same cargo for all stops?" or modify Cargo Item 1
                            </p>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cargo Size <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            {[
                              { value: 'small', label: 'Small', desc: 'Fits in car' },
                              { value: 'medium', label: 'Medium', desc: 'Needs van' },
                              { value: 'large', label: 'Large', desc: 'Needs truck' },
                            ].map((size) => (
                              <button
                                key={size.value}
                                type="button"
                                onClick={() => !isInheritedCargo && updateCargoItem(item.id, { cargoSize: size.value as 'small' | 'medium' | 'large' })}
                                disabled={isInheritedCargo}
                                className={`p-2.5 sm:p-4 rounded-lg border-2 transition-all text-center ${
                                  item.cargoSize === size.value
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                } ${isInheritedCargo ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                <Package className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1.5 sm:mb-2 ${
                                  item.cargoSize === size.value ? 'text-blue-600' : 'text-gray-400'
                                }`} />
                                <p className="font-semibold text-gray-900 text-sm sm:text-base">{size.label}</p>
                                <p className="text-[11px] sm:text-xs text-gray-600 leading-tight">{size.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {item.cargoSize === 'large' && (
                          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                            <label className="block text-sm font-semibold text-amber-900 mb-1">
                              Estimated Dimensions <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-amber-700 mb-3">
                              Approximate measurements help drivers choose the right vehicle
                            </p>
                            <div className="space-y-2.5">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Length</label>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={item.dimensionsLength}
                                    onChange={(e) => !isInheritedCargo && updateCargoItem(item.id, { dimensionsLength: e.target.value })}
                                    disabled={isInheritedCargo}
                                    placeholder="0"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                                  />
                                  <select
                                    value={item.dimensionsLengthUnit}
                                    onChange={(e) => !isInheritedCargo && updateCargoItem(item.id, { dimensionsLengthUnit: e.target.value as 'cm' | 'in' | 'ft' })}
                                    disabled={isInheritedCargo}
                                    className="w-[72px] px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium text-gray-700 bg-white"
                                  >
                                    <option value="ft">ft</option>
                                    <option value="in">in</option>
                                    <option value="cm">cm</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Width</label>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={item.dimensionsWidth}
                                    onChange={(e) => !isInheritedCargo && updateCargoItem(item.id, { dimensionsWidth: e.target.value })}
                                    disabled={isInheritedCargo}
                                    placeholder="0"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                                  />
                                  <select
                                    value={item.dimensionsWidthUnit}
                                    onChange={(e) => !isInheritedCargo && updateCargoItem(item.id, { dimensionsWidthUnit: e.target.value as 'cm' | 'in' | 'ft' })}
                                    disabled={isInheritedCargo}
                                    className="w-[72px] px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium text-gray-700 bg-white"
                                  >
                                    <option value="in">in</option>
                                    <option value="ft">ft</option>
                                    <option value="cm">cm</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Height</label>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={item.dimensionsHeight}
                                    onChange={(e) => !isInheritedCargo && updateCargoItem(item.id, { dimensionsHeight: e.target.value })}
                                    disabled={isInheritedCargo}
                                    placeholder="0"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                                  />
                                  <select
                                    value={item.dimensionsHeightUnit}
                                    onChange={(e) => !isInheritedCargo && updateCargoItem(item.id, { dimensionsHeightUnit: e.target.value as 'cm' | 'in' | 'ft' })}
                                    disabled={isInheritedCargo}
                                    className="w-[72px] px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium text-gray-700 bg-white"
                                  >
                                    <option value="in">in</option>
                                    <option value="ft">ft</option>
                                    <option value="cm">cm</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cargo Category <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                            {[
                              { value: 'furniture', label: 'Furniture', icon: Sofa },
                              { value: 'electronics', label: 'Electronics', icon: Laptop },
                              { value: 'vehicles', label: 'Vehicles', icon: Car },
                              { value: 'equipment', label: 'Equipment', icon: Wrench },
                              { value: 'pallets', label: 'Pallets', icon: Layers },
                              { value: 'boxes', label: 'Boxes', icon: Box },
                              { value: 'other', label: 'Other', icon: FileQuestion },
                            ].map((category) => {
                              const CategoryIcon = category.icon;
                              return (
                                <button
                                  key={category.value}
                                  type="button"
                                  onClick={() => !isInheritedCargo && updateCargoItem(item.id, { cargoCategory: category.value as any })}
                                  disabled={isInheritedCargo}
                                  className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all ${
                                    item.cargoCategory === category.value
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 hover:border-gray-300'
                                  } ${isInheritedCargo ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                  <CategoryIcon className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 ${
                                    item.cargoCategory === category.value ? 'text-blue-600' : 'text-gray-400'
                                  }`} />
                                  <p className={`text-xs sm:text-sm font-medium ${
                                    item.cargoCategory === category.value ? 'text-blue-700' : 'text-gray-700'
                                  }`}>{category.label}</p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {item.cargoCategory === 'other' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Specify Category <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={item.cargoCategoryCustom}
                              onChange={(e) => !isInheritedCargo && updateCargoItem(item.id, { cargoCategoryCustom: e.target.value })}
                              disabled={isInheritedCargo}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="e.g., Construction materials, Medical supplies..."
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Weight (optional)
                          </label>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <input
                                type="number"
                                value={item.cargoWeight}
                                onChange={(e) => !isInheritedCargo && updateCargoItem(item.id, { cargoWeight: e.target.value })}
                                disabled={isInheritedCargo}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                                placeholder="e.g., 50"
                                min="0"
                                step="0.1"
                              />
                            </div>
                            <div className="flex rounded-lg border-2 border-gray-300 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => !isInheritedCargo && updateCargoItem(item.id, { weightUnit: 'kg' })}
                                disabled={isInheritedCargo}
                                className={`px-4 py-2 font-medium transition-all ${
                                  item.weightUnit === 'kg'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                } ${isInheritedCargo ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                KG
                              </button>
                              <button
                                type="button"
                                onClick={() => !isInheritedCargo && updateCargoItem(item.id, { weightUnit: 'lbs' })}
                                disabled={isInheritedCargo}
                                className={`px-4 py-2 font-medium transition-all ${
                                  item.weightUnit === 'lbs'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                } ${isInheritedCargo ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                LBS
                              </button>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cargo Photo (optional)
                          </label>
                          {!item.cargoPhotoPreview ? (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-600">Click to upload photo</p>
                                <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                              </div>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handlePhotoSelect(item.id, e)}
                              />
                            </label>
                          ) : (
                            <div className="relative">
                              <img
                                src={item.cargoPhotoPreview}
                                alt="Cargo preview"
                                className="w-full h-48 object-cover rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(item.id)}
                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Additional Notes (optional)
                          </label>
                          <textarea
                            value={item.cargoNotes}
                            onChange={(e) => !isInheritedCargo && updateCargoItem(item.id, { cargoNotes: e.target.value })}
                            disabled={isInheritedCargo}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                            rows={3}
                            placeholder="Any special handling instructions..."
                          />
                        </div>

                        {isMultiStop && multiStopDropoffs.length > 0 && (
                          <div className="border-t-2 border-green-100 pt-6">
                            <div className={`border rounded-lg p-4 mb-4 ${item.isExtra ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                              <div className="flex items-center gap-2">
                                <MapPin className={`w-5 h-5 ${item.isExtra ? 'text-amber-600' : 'text-green-600'}`} />
                                <h4 className="font-semibold text-gray-900">Assign to Delivery Stop</h4>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {item.isExtra
                                  ? 'Optional: Select a drop-off stop for this extra cargo, or leave unassigned'
                                  : 'Select which drop-off stop this cargo item should be delivered to'}
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Deliver to Stop {!item.isExtra && <span className="text-red-500">*</span>}
                                {item.isExtra && <span className="text-gray-500 text-xs ml-1">(Optional)</span>}
                              </label>
                              <select
                                value={item.assignedStopId}
                                onChange={(e) => {
                                  const stopId = e.target.value;
                                  const stopIndex = multiStopDropoffs.findIndex(d => d.id === stopId);
                                  updateCargoItem(item.id, {
                                    assignedStopId: stopId,
                                    assignedStopIndex: stopIndex
                                  });
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              >
                                {multiStopDropoffs.map((dropoff, index) => (
                                  <option key={dropoff.id} value={dropoff.id}>
                                    Stop {index + 1}{dropoff.address ? `: ${dropoff.address}` : ' (Not set)'}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {userBusinessType === 'retail' && hasMultipleDropoffs && !isMultiStop && (
                          <div className="border-t-2 border-purple-100 pt-6">
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-purple-600" />
                                <h4 className="font-semibold text-gray-900">Delivery Location for This Item</h4>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                Specify where this specific item should be delivered
                              </p>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Dropoff Address <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={item.dropoffLocation.text}
                                  onChange={(e) => updateCargoItem(item.id, {
                                    dropoffLocation: {
                                      text: e.target.value,
                                      lat: 0,
                                      lng: 0
                                    }
                                  })}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  placeholder="Enter delivery address for this item"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Recipient Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={item.dropoffContactName}
                                  onChange={(e) => updateCargoItem(item.id, { dropoffContactName: e.target.value })}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  placeholder="Who will receive this item?"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Recipient Phone <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="tel"
                                  value={item.dropoffContactPhone}
                                  onChange={(e) => updateCargoItem(item.id, { dropoffContactPhone: e.target.value })}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  placeholder="Contact number for delivery"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>)}

            <div className="space-y-6">
              {!((jobType === 'junk_removal' || jobType === 'marketplace_safebuy' || jobType === 'courier') && isNormalCustomer) && (<>
              {/* Special Requirements */}
              <div className="border-2 border-orange-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSpecialRequirements(!showSpecialRequirements)}
                  className="w-full p-4 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">Special Requirements</p>
                      <p className="text-xs text-gray-600">
                        {isFragile || needsCover || requiresHeavyLift || hasSecurityGate || cashToReturn
                          ? `${[isFragile, needsCover, requiresHeavyLift, hasSecurityGate, cashToReturn].filter(Boolean).length} selected`
                          : 'Optional delivery needs'}
                      </p>
                    </div>
                  </div>
                  {showSpecialRequirements ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>

                {showSpecialRequirements && (
                  <div className="p-4 bg-white space-y-3 border-t border-orange-200">
                    <div
                      onClick={() => setIsFragile(!isFragile)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        isFragile
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isFragile ? 'bg-red-500' : 'bg-gray-200'
                        }`}>
                          <AlertTriangle className={`w-5 h-5 ${isFragile ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 mb-1">Fragile Cargo</p>
                          <p className="text-sm text-gray-600">
                            Items need extra care and gentle handling during transport
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          isFragile ? 'bg-red-500 border-red-500' : 'border-gray-300'
                        }`}>
                          {isFragile && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setNeedsCover(!needsCover)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        needsCover
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          needsCover ? 'bg-blue-500' : 'bg-gray-200'
                        }`}>
                          <Shield className={`w-5 h-5 ${needsCover ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 mb-1">Needs Cover/Protection</p>
                          <p className="text-sm text-gray-600">
                            Cargo must be covered or protected from weather/elements
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          needsCover ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}>
                          {needsCover && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setRequiresHeavyLift(!requiresHeavyLift)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        requiresHeavyLift
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          requiresHeavyLift ? 'bg-purple-500' : 'bg-gray-200'
                        }`}>
                          <Dumbbell className={`w-5 h-5 ${requiresHeavyLift ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 mb-1">Heavy Lift Required</p>
                          <p className="text-sm text-gray-600">
                            Heavy items requiring lorry man or additional assistance
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          requiresHeavyLift ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                        }`}>
                          {requiresHeavyLift && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setHasSecurityGate(!hasSecurityGate)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        hasSecurityGate
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          hasSecurityGate ? 'bg-green-500' : 'bg-gray-200'
                        }`}>
                          <Lock className={`w-5 h-5 ${hasSecurityGate ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 mb-1">Security Gate Access</p>
                          <p className="text-sm text-gray-600">
                            Delivery location has security gate requiring clearance
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          hasSecurityGate ? 'bg-green-500 border-green-500' : 'border-gray-300'
                        }`}>
                          {hasSecurityGate && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => {
                        const newVal = !cashToReturn;
                        setCashToReturn(newVal);
                        if (!newVal) {
                          setCashToReturnAmount('');
                        } else {
                          if (proofOfDelivery !== 'SIGNATURE' && proofOfDelivery !== 'PHOTO_AND_SIGNATURE') {
                            setProofOfDelivery('SIGNATURE');
                            setShowProofOfDelivery(true);
                          }
                        }
                      }}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        cashToReturn
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          cashToReturn ? 'bg-amber-500' : 'bg-gray-200'
                        }`}>
                          <Banknote className={`w-5 h-5 ${cashToReturn ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 mb-1">Cash to be Returned</p>
                          <p className="text-sm text-gray-600">
                            Recipient pays cash on delivery, driver returns it to you
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          cashToReturn ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                        }`}>
                          {cashToReturn && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>

                    {cashToReturn && (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-2">
                            Amount to Collect (TTD) <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-lg">$</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={cashToReturnAmount}
                              onChange={(e) => setCashToReturnAmount(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="0.00"
                              className="w-full pl-10 pr-4 py-3 text-xl font-bold text-amber-700 border-2 border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                            />
                          </div>
                        </div>

                        <div className="bg-teal-50 rounded-lg p-3 border-2 border-teal-300">
                          <div className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-teal-700 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-teal-900">E-Signature required for cash jobs</p>
                              <p className="text-xs text-teal-700 mt-0.5">
                                Recipient must sign to confirm the cash amount. This protects both parties and eliminates disputes.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-3 border border-amber-200">
                          <p className="text-xs font-semibold text-amber-900 mb-2">How it works:</p>
                          <div className="space-y-1.5">
                            <p className="text-xs text-amber-800 flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                              Driver delivers cargo to recipient
                            </p>
                            <p className="text-xs text-amber-800 flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                              Recipient pays cash and signs to confirm exact amount
                            </p>
                            <p className="text-xs text-amber-800 flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                              Driver returns cash to you -- job locked until cash is returned
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {(isFragile || needsCover || requiresHeavyLift || hasSecurityGate) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Additional Details (optional)
                        </label>
                        <textarea
                          value={specialRequirementsNotes}
                          onChange={(e) => setSpecialRequirementsNotes(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          rows={2}
                          placeholder="Provide any additional details about these requirements..."
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Estimated Value */}
              <div className="border-2 border-blue-200 rounded-xl overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-sky-50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Estimated Value of Items (TTD)</p>
                      <p className="text-xs text-gray-600">Optional -- helps determine coverage</p>
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={declaredCargoValue}
                      onChange={(e) => {
                        setDeclaredCargoValue(e.target.value);
                        const val = parseFloat(e.target.value) || 0;
                        if (val <= INSURANCE_TRIGGER_THRESHOLD) {
                          setCargoInsuranceEnabled(false);
                        }
                      }}
                      placeholder="0"
                      className="w-full pl-8 pr-16 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">TTD</span>
                  </div>

                  {!declaredCargoValue || parsedCargoValue === 0 ? (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-amber-700">Standard Liability ($500 max coverage)</span>
                    </div>
                  ) : null}

                  {isHighValue && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-sky-50 border border-sky-300 rounded-lg">
                      <Gem className="w-4 h-4 text-sky-600 flex-shrink-0" />
                      <span className="text-xs font-bold text-sky-800">High Value Shipment -- Priority courier matching (4.8+ star rated drivers only)</span>
                    </div>
                  )}

                  {showInsuranceToggle && (
                    <div
                      onClick={() => setCargoInsuranceEnabled(!cargoInsuranceEnabled)}
                      className={`mt-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        cargoInsuranceEnabled
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          cargoInsuranceEnabled ? 'bg-emerald-500' : 'bg-gray-200'
                        }`}>
                          <ShieldCheck className={`w-5 h-5 ${cargoInsuranceEnabled ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 mb-0.5">Protect Your Cargo</p>
                          <p className="text-sm text-gray-600">Full coverage insurance at 1.5% of declared value</p>
                          {cargoInsuranceEnabled && (
                            <div className="mt-2 px-3 py-1.5 bg-emerald-100 rounded-md inline-block">
                              <span className="text-sm font-bold text-emerald-800">+${insuranceFee.toFixed(2)} TTD for full coverage</span>
                            </div>
                          )}
                        </div>
                        <div className={`w-12 h-7 rounded-full flex items-center transition-all flex-shrink-0 ${
                          cargoInsuranceEnabled ? 'bg-emerald-500 justify-end' : 'bg-gray-300 justify-start'
                        }`}>
                          <div className="w-5 h-5 bg-white rounded-full shadow mx-1" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Proof of Delivery */}
                <div className={`border-2 rounded-xl overflow-hidden transition-all ${
                  cashToReturn ? 'border-teal-400 ring-2 ring-teal-200 shadow-md shadow-teal-100' : 'border-teal-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => setShowProofOfDelivery(!showProofOfDelivery)}
                    className={`w-full p-4 transition-all flex items-center justify-between ${
                      cashToReturn
                        ? 'bg-gradient-to-r from-teal-100 to-cyan-100'
                        : 'bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        cashToReturn ? 'bg-teal-600 ring-2 ring-teal-300' : 'bg-teal-500'
                      }`}>
                        <FileCheck className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">Proof of Delivery</p>
                          {cashToReturn && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full border border-amber-300">
                              REQUIRED FOR CASH
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600">
                          {proofOfDelivery === 'PHOTO' && 'Photo proof required'}
                          {proofOfDelivery === 'SIGNATURE' && 'E-signature required'}
                          {proofOfDelivery === 'PHOTO_AND_SIGNATURE' && 'Photo + E-signature (recommended)'}
                          {proofOfDelivery === 'NONE' && 'Not required'}
                        </p>
                      </div>
                    </div>
                    {showProofOfDelivery ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </button>

                  {showProofOfDelivery && (
                    <div className="p-4 bg-white space-y-3 border-t border-teal-200">
                      {cashToReturn && (
                        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
                          <Banknote className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-800 font-medium">
                            Cash jobs require e-signature so the recipient can confirm the cash amount paid. Options without signatures are disabled.
                          </p>
                        </div>
                      )}
                      <div
                        onClick={() => setProofOfDelivery('PHOTO_AND_SIGNATURE')}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          proofOfDelivery === 'PHOTO_AND_SIGNATURE'
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            proofOfDelivery === 'PHOTO_AND_SIGNATURE' ? 'bg-teal-500' : 'bg-gray-200'
                          }`}>
                            <FileCheck className={`w-5 h-5 ${proofOfDelivery === 'PHOTO_AND_SIGNATURE' ? 'text-white' : 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900">Photo + E-signature</p>
                              <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded-full">
                                Recommended
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              Courier must collect both photo proof and recipient signature (mobile)
                            </p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            proofOfDelivery === 'PHOTO_AND_SIGNATURE' ? 'bg-teal-500 border-teal-500' : 'border-gray-300'
                          }`}>
                            {proofOfDelivery === 'PHOTO_AND_SIGNATURE' && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => !cashToReturn && setProofOfDelivery('PHOTO')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          cashToReturn
                            ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                            : proofOfDelivery === 'PHOTO'
                              ? 'border-blue-500 bg-blue-50 cursor-pointer'
                              : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            proofOfDelivery === 'PHOTO' && !cashToReturn ? 'bg-blue-500' : 'bg-gray-200'
                          }`}>
                            <Camera className={`w-5 h-5 ${proofOfDelivery === 'PHOTO' && !cashToReturn ? 'text-white' : 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1">
                            <p className={`font-semibold mb-1 ${cashToReturn ? 'text-gray-400' : 'text-gray-900'}`}>Photo proof of delivery</p>
                            <p className={`text-sm ${cashToReturn ? 'text-gray-400' : 'text-gray-600'}`}>
                              {cashToReturn ? 'Not available for cash jobs (signature required)' : 'Courier must take photos of the cargo at the delivery location'}
                            </p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            proofOfDelivery === 'PHOTO' && !cashToReturn ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                          }`}>
                            {proofOfDelivery === 'PHOTO' && !cashToReturn && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => setProofOfDelivery('SIGNATURE')}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          proofOfDelivery === 'SIGNATURE'
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            proofOfDelivery === 'SIGNATURE' ? 'bg-purple-500' : 'bg-gray-200'
                          }`}>
                            <FileCheck className={`w-5 h-5 ${proofOfDelivery === 'SIGNATURE' ? 'text-white' : 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 mb-1">Recipient e-signature (Mobile only)</p>
                            <p className="text-sm text-gray-600">
                              Recipient must sign on the courier's mobile device at delivery
                            </p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            proofOfDelivery === 'SIGNATURE' ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                          }`}>
                            {proofOfDelivery === 'SIGNATURE' && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => !cashToReturn && setProofOfDelivery('NONE')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          cashToReturn
                            ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                            : proofOfDelivery === 'NONE'
                              ? 'border-gray-400 bg-gray-50 cursor-pointer'
                              : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            proofOfDelivery === 'NONE' && !cashToReturn ? 'bg-gray-400' : 'bg-gray-200'
                          }`}>
                            <X className={`w-5 h-5 ${proofOfDelivery === 'NONE' && !cashToReturn ? 'text-white' : 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1">
                            <p className={`font-semibold mb-1 ${cashToReturn ? 'text-gray-400' : 'text-gray-900'}`}>Not required</p>
                            <p className={`text-sm ${cashToReturn ? 'text-gray-400' : 'text-gray-600'}`}>
                              {cashToReturn ? 'Not available for cash jobs (signature required)' : 'No proof of delivery required'}
                            </p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            proofOfDelivery === 'NONE' && !cashToReturn ? 'bg-gray-400 border-gray-400' : 'border-gray-300'
                          }`}>
                            {proofOfDelivery === 'NONE' && !cashToReturn && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>)}

              {(() => {
                let totalDropoffsCount = 0;

                if (isMultiStop) {
                  if (hasMultiplePickups) {
                    // Sum all dropoffs across all pickup groups
                    totalDropoffsCount = pickupGroups.reduce((sum, group) => sum + group.dropoffs.length, 0);
                  } else {
                    // Count dropoffs from multiStopDropoffs array
                    totalDropoffsCount = multiStopDropoffs.length;
                  }
                } else {
                  // Single dropoff job
                  totalDropoffsCount = 1;
                }

                // Show delivery order selector for all multi-stop jobs with multiple dropoffs
                return totalDropoffsCount > 1;
              })() && (
                <div className="border-2 border-purple-200 rounded-xl overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                        <Layers className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">Delivery Order</p>
                        <p className="text-xs text-gray-600">
                          Specify if items must be delivered in a specific order
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white space-y-3 border-t border-purple-200">
                    <div
                      onClick={() => setDeliveryOrderType('sequential')}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        deliveryOrderType === 'sequential'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          deliveryOrderType === 'sequential' ? 'bg-blue-500' : 'bg-gray-200'
                        }`}>
                          <Layers className={`w-5 h-5 ${deliveryOrderType === 'sequential' ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900">Sequential Order</p>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                              Recommended
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Items must be delivered in the order listed (e.g., perishables first)
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          deliveryOrderType === 'sequential' ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}>
                          {deliveryOrderType === 'sequential' && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setDeliveryOrderType('flexible')}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        deliveryOrderType === 'flexible'
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          deliveryOrderType === 'flexible' ? 'bg-emerald-500' : 'bg-gray-200'
                        }`}>
                          <Layers className={`w-5 h-5 ${deliveryOrderType === 'flexible' ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 mb-1">Flexible Order</p>
                          <p className="text-sm text-gray-600">
                            Courier can deliver items in any order (most efficient)
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          deliveryOrderType === 'flexible' ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                        }`}>
                          {deliveryOrderType === 'flexible' && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {jobType === 'marketplace_safebuy' && isNormalCustomer && (
                <div className="mt-6 space-y-5">
                  <div className="p-5 bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2 mb-5">
                      <ShoppingBag className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-gray-900 text-lg">Marketplace Safe-Buy</h3>
                    </div>

                    <div className="space-y-5">
                      <div className="p-4 bg-white rounded-xl border border-blue-100 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Image className="w-4 h-4 text-blue-600" />
                          <h4 className="font-semibold text-gray-900 text-sm">Item Verification</h4>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Link to Item Ad (Facebook/Pin.tt)</label>
                          <div className="relative">
                            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="url"
                              value={marketplaceListingUrl}
                              onChange={(e) => setMarketplaceListingUrl(e.target.value)}
                              placeholder="Paste the listing link here"
                              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Screenshot/Photo of the Item *</label>
                          {marketplaceItemScreenshotPreview ? (
                            <div className="relative">
                              <img
                                src={marketplaceItemScreenshotPreview}
                                alt="Item screenshot"
                                className="w-full h-48 object-cover rounded-lg border border-gray-200"
                              />
                              <button
                                onClick={() => {
                                  setMarketplaceItemScreenshot(null);
                                  setMarketplaceItemScreenshotPreview('');
                                }}
                                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer bg-blue-50/50 hover:bg-blue-50 transition-colors">
                              <Camera className="w-8 h-8 text-blue-400 mb-2" />
                              <span className="text-sm font-medium text-blue-600">Tap to upload photo</span>
                              <span className="text-xs text-gray-500 mt-0.5">PNG, JPG up to 5MB</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setMarketplaceItemScreenshot(file);
                                    setMarketplaceItemScreenshotPreview(URL.createObjectURL(file));
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-xl border border-blue-100 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <UserCircle className="w-4 h-4 text-blue-600" />
                          <h4 className="font-semibold text-gray-900 text-sm">Seller Details</h4>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Seller Name *</label>
                          <input
                            type="text"
                            value={marketplaceSellerContact}
                            onChange={(e) => setMarketplaceSellerContact(e.target.value)}
                            placeholder="e.g. John Smith"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Seller Phone Number *</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="tel"
                              value={marketplaceSellerPhone}
                              onChange={(e) => setMarketplaceSellerPhone(e.target.value)}
                              placeholder="868-555-1234"
                              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-xl border border-blue-100 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <ClipboardList className="w-4 h-4 text-blue-600" />
                          <h4 className="font-semibold text-gray-900 text-sm">Proxy Inspection Checklist</h4>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Instructions for Driver</label>
                          <textarea
                            value={marketplaceInspectionInstructions}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMarketplaceInspectionInstructions(val);
                              const cashPattern = /\b(pay\s+cash|carry\s+cash|bring\s+cash|give.*cash|hand.*cash|cash\s+payment|physical\s+cash)\b/i;
                              setMarketplaceCashWarning(cashPattern.test(val));
                            }}
                            placeholder={"e.g.\n1. Check for scratches on the screen\n2. Ensure it powers on\n3. Verify all accessories included"}
                            rows={4}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                          />
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            Tell the driver exactly what to check. Max 3 instructions.
                          </p>
                        </div>

                        <div
                          onClick={() => setMarketplaceRequirePhoto(!marketplaceRequirePhoto)}
                          className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                            marketplaceRequirePhoto
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              marketplaceRequirePhoto ? 'bg-blue-600' : 'bg-gray-300'
                            }`}>
                              <Camera className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${marketplaceRequirePhoto ? 'text-blue-900' : 'text-gray-700'}`}>
                                Require photo of item
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Driver must send a live photo during inspection
                              </p>
                            </div>
                          </div>
                          <div className={`w-11 h-6 rounded-full flex items-center transition-all ${
                            marketplaceRequirePhoto ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'
                          }`}>
                            <div className="w-5 h-5 bg-white rounded-full shadow-sm mx-0.5" />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-xl border border-blue-100 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-4 h-4 text-blue-600" />
                          <h4 className="font-semibold text-gray-900 text-sm">Payment Status</h4>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">How is the seller being paid? *</label>
                          <div className="space-y-2.5">
                            <div
                              onClick={() => {
                                setMarketplacePaymentStatus('already_paid');
                                setMarketplaceCashWarning(false);
                              }}
                              className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                                marketplacePaymentStatus === 'already_paid'
                                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  marketplacePaymentStatus === 'already_paid' ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                }`}>
                                  {marketplacePaymentStatus === 'already_paid' && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">I already paid the seller</p>
                                  <p className="text-xs text-gray-500">Driver just picks up the item</p>
                                </div>
                              </div>
                            </div>

                            <div
                              onClick={() => {
                                setMarketplacePaymentStatus('pay_after_inspection');
                                setMarketplaceCashWarning(false);
                              }}
                              className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                                marketplacePaymentStatus === 'pay_after_inspection'
                                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  marketplacePaymentStatus === 'pay_after_inspection' ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                }`}>
                                  {marketplacePaymentStatus === 'pay_after_inspection' && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">I will transfer money AFTER driver inspects</p>
                                  <p className="text-xs text-gray-500">Digital transfer to seller after you approve photos</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {marketplaceCashWarning && (
                          <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-lg">
                            <div className="flex items-start gap-2.5">
                              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-bold text-red-800">Cash Purchases Not Allowed</p>
                                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                                  For security reasons, MoveMeTT drivers do not carry cash to purchase items on your behalf. All item payments must be handled digitally between you and the seller.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Max Budget for Item (TTD)</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={marketplaceMaxBudget}
                            onChange={(e) => setMarketplaceMaxBudget(e.target.value)}
                            placeholder="Maximum you're willing to pay"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-gradient-to-r from-blue-100 to-sky-100 rounded-xl border border-blue-200">
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-blue-900">How Safe-Buy Works</p>
                            <ol className="mt-2 space-y-1.5 text-xs text-blue-800 leading-relaxed">
                              <li className="flex items-start gap-2">
                                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">1</span>
                                Driver goes to the seller and inspects the item using your checklist
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">2</span>
                                Driver takes a live photo and sends it to you for approval
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">3</span>
                                You approve the photo and finalize payment to the seller
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">4</span>
                                Driver collects the item and delivers it safely to you
                              </li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {jobType === 'junk_removal' && isNormalCustomer && (
                <div className="mt-6 space-y-5">
                  <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-5">
                      <Trash2 className="w-5 h-5 text-amber-600" />
                      <h3 className="font-bold text-gray-900 text-lg">Junk Removal Details</h3>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Upload a photo of the junk <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-3">So the driver brings the right truck</p>
                        {!junkPhotoPreview ? (
                          <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-amber-300 border-dashed rounded-xl cursor-pointer hover:border-amber-500 hover:bg-amber-50/50 transition-all bg-white">
                            <Camera className="w-10 h-10 text-amber-400 mb-2" />
                            <p className="text-sm font-medium text-gray-700">Tap to take photo or upload</p>
                            <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 5 * 1024 * 1024) { setError('Photo must be less than 5MB'); return; }
                                if (!file.type.startsWith('image/')) { setError('File must be an image'); return; }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setJunkPhoto(file);
                                  setJunkPhotoPreview(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                                setError('');
                              }}
                            />
                          </label>
                        ) : (
                          <div className="relative">
                            <img src={junkPhotoPreview} alt="Junk preview" className="w-full h-48 object-cover rounded-xl border-2 border-amber-200" />
                            <button
                              type="button"
                              onClick={() => { setJunkPhoto(null); setJunkPhotoPreview(''); }}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          What type of waste? <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {JUNK_WASTE_CATEGORY_OPTIONS.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setJunkWasteCategories(prev =>
                                  prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                );
                              }}
                              className={`px-3 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                                junkWasteCategories.includes(cat)
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Additional description</label>
                        <input
                          type="text"
                          value={junkDisposalType}
                          onChange={(e) => setJunkDisposalType(e.target.value)}
                          placeholder="e.g. 2 old sofas and a broken fridge"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-white rounded-xl border-2 border-gray-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">Is the junk already outside on the curb?</p>
                        <p className="text-xs text-gray-500 mt-0.5">If not, an extra fee applies for indoor retrieval</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setJunkCurbside(!junkCurbside)}
                        className={`relative w-14 h-7 rounded-full transition-all duration-300 ${junkCurbside ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${junkCurbside ? 'left-7' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {!junkCurbside && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg animate-in fade-in duration-200">
                        <div className="flex items-center gap-2">
                          <Dumbbell className="w-5 h-5 text-amber-600" />
                          <div>
                            <p className="font-semibold text-amber-900">Not on Curb</p>
                            <p className="text-sm text-amber-700">+ ${JUNK_NOT_ON_CURB_FEE}.00 TTD surcharge for indoor retrieval</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">Need an extra hand?</p>
                          <p className="text-xs text-gray-500 mt-0.5">Driver will bring a helper for heavy or bulky items</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setJunkNeedExtraHand(!junkNeedExtraHand)}
                          className={`relative w-14 h-7 rounded-full transition-all duration-300 ${junkNeedExtraHand ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${junkNeedExtraHand ? 'left-7' : 'left-0.5'}`} />
                        </button>
                      </div>

                      {junkNeedExtraHand && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in duration-200">
                          <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="font-semibold text-blue-900">Extra Helper Included</p>
                              <p className="text-sm text-blue-700">+ ${JUNK_EXTRA_HAND_FEE}.00 TTD surcharge for an additional person</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={junkSafetyAcknowledged}
                        onChange={(e) => setJunkSafetyAcknowledged(e.target.checked)}
                        className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 mt-0.5 flex-shrink-0"
                      />
                      <div>
                        <span className="font-semibold text-red-900 text-sm">Safety Acknowledgment <span className="text-red-500">*</span></span>
                        <p className="text-xs text-red-700 mt-1">
                          I confirm there are no hazardous materials, chemicals, or wet paint in this load. Violations may result in account suspension and additional charges.
                        </p>
                      </div>
                    </label>
                  </div>

                  {dropoff.text && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-green-900">Auto-routed to nearest landfill</p>
                          <p className="text-sm text-green-700 mt-0.5">{dropoff.text}</p>
                          {distance > 0 && <p className="text-xs text-green-600 mt-1">{distance} km from pickup</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(STEP_LOCATIONS)}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleCargoStep}
                  className="flex-1 py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 transition-all"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {step === STEP_PRICING && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6">Job Summary</h2>

              <div className="space-y-4">
                {isNormalCustomer && jobType !== 'standard' && (
                  <div className={`p-3 rounded-lg border flex items-center gap-3 ${
                    jobType === 'courier' ? 'bg-teal-50 border-teal-200' :
                    jobType === 'marketplace_safebuy' ? 'bg-blue-50 border-blue-200' :
                    jobType === 'junk_removal' ? 'bg-amber-50 border-amber-200' :
                    'bg-rose-50 border-rose-200'
                  }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      jobType === 'courier' ? 'bg-teal-100 text-teal-600' :
                      jobType === 'marketplace_safebuy' ? 'bg-blue-100 text-blue-600' :
                      jobType === 'junk_removal' ? 'bg-amber-100 text-amber-600' :
                      'bg-rose-100 text-rose-600'
                    }`}>
                      {jobType === 'courier' && <Zap className="w-4 h-4" />}
                      {jobType === 'marketplace_safebuy' && <ShoppingBag className="w-4 h-4" />}
                      {jobType === 'junk_removal' && <Trash2 className="w-4 h-4" />}
                    </div>
                    <span className="font-medium text-sm text-gray-900">
                      {jobType === 'courier' && 'Courier Mode'}
                      {jobType === 'marketplace_safebuy' && 'Marketplace Safe-Buy'}
                      {jobType === 'junk_removal' && 'Junk Removal'}
                    </span>
                  </div>
                )}

                <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">
                        {isMultiStop ? 'Total Route Distance' : 'Distance'}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      {isMultiStop ? multiStopDistance : distance} km
                    </span>
                  </div>
                  {isMultiStop && multiStopEta > 0 && (
                    <div className="mb-2 text-sm text-gray-600">
                      Estimated Time: <span className="font-semibold">{formatMinutesToHoursMinutes(multiStopEta)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-blue-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                        style={{ width: `${Math.min(((isMultiStop ? multiStopDistance : distance) / 50) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">
                      {(isMultiStop ? multiStopDistance : distance) < 25 ? 'Short' : (isMultiStop ? multiStopDistance : distance) < 50 ? 'Medium' : 'Long'}
                    </span>
                  </div>
                  {isMultiStop && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs text-gray-600">
                        <span className="font-semibold">Route:</span>{' '}
                        {multiStopPickups.length} pickup{multiStopPickups.length > 1 ? 's' : ''} → {multiStopDropoffs.length} drop-off{multiStopDropoffs.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>

                {jobType === 'marketplace_safebuy' && isNormalCustomer && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-sky-50 rounded-xl border-2 border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <ShoppingBag className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">Marketplace Item Details</span>
                    </div>
                    <div className="space-y-3">
                      {marketplaceItemScreenshotPreview && (
                        <div className="rounded-lg overflow-hidden border border-blue-200">
                          <img
                            src={marketplaceItemScreenshotPreview}
                            alt="Item photo"
                            className="w-full h-40 object-cover"
                          />
                        </div>
                      )}
                      {marketplaceListingUrl && (
                        <div className="flex items-center gap-2 text-sm">
                          <Link className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="text-gray-600">Listing:</span>
                          <a href={marketplaceListingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium truncate hover:underline">
                            {marketplaceListingUrl}
                          </a>
                        </div>
                      )}
                      {marketplaceSellerContact && (
                        <div className="flex items-center gap-2 text-sm">
                          <UserCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="text-gray-600">Seller:</span>
                          <span className="font-medium text-gray-900">{marketplaceSellerContact}</span>
                        </div>
                      )}
                      {marketplaceSellerPhone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium text-gray-900">{marketplaceSellerPhone}</span>
                        </div>
                      )}
                      {marketplaceMaxBudget && (
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="text-gray-600">Max Budget:</span>
                          <span className="font-medium text-gray-900">TTD ${parseFloat(marketplaceMaxBudget).toLocaleString()}</span>
                        </div>
                      )}
                      {marketplaceInspectionInstructions && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <div className="flex items-center gap-2 mb-1">
                            <ClipboardList className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-semibold text-gray-900">Inspection Instructions</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-line pl-6">{marketplaceInspectionInstructions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {jobType === 'courier' && isNormalCustomer && (
                  <div className="p-4 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border-2 border-teal-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-5 h-5 text-teal-600" />
                      <span className="font-semibold text-gray-900">Courier Details</span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Package</span>
                        <span className="font-medium text-gray-900">
                          {courierCargoSize === 'envelope' ? 'Envelope' : courierCargoSize === 'small_parcel' ? 'Small Parcel' : 'Medium Box'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Recipient</span>
                        <span className="font-medium text-gray-900">{courierRecipientName}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Recipient Phone</span>
                        <span className="font-medium text-gray-900">{courierRecipientPhone}</span>
                      </div>
                      {courierBuildingDetails && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Building</span>
                          <span className="font-medium text-gray-900 text-right max-w-[60%] truncate">{courierBuildingDetails}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {courierRequireSignature && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                            <FileCheck className="w-3 h-3" />
                            Signature Required
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <ShieldCheck className="w-3 h-3" />
                          Safety Acknowledged
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {!((jobType === 'marketplace_safebuy' || jobType === 'courier') && isNormalCustomer) && (
                <div className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-5 h-5 text-teal-600" />
                    <span className="font-semibold text-gray-900">Cargo Items ({cargoItems.length})</span>
                  </div>
                  <div className="space-y-3">
                    {cargoItems.map((item, index) => (
                      <div key={item.id} className="p-3 bg-white rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-sm text-purple-700">Item {index + 1}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Size:</span>
                            <span className="font-medium text-gray-900 capitalize">{item.cargoSize}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Type:</span>
                            <span className="font-medium text-gray-900 capitalize">
                              {item.cargoCategory === 'other' ? item.cargoCategoryCustom : item.cargoCategory}
                            </span>
                          </div>
                          {item.cargoWeight && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">Weight:</span>
                              <span className="font-medium text-gray-900">{item.cargoWeight} {item.weightUnit}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {(isFragile || needsCover || requiresHeavyLift || hasSecurityGate || cashToReturn) && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-semibold text-gray-900">Special Requirements</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isFragile && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            Fragile
                          </span>
                        )}
                        {needsCover && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            <Shield className="w-3 h-3" />
                            Needs Cover
                          </span>
                        )}
                        {requiresHeavyLift && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            <Dumbbell className="w-3 h-3" />
                            Heavy Lift
                          </span>
                        )}
                        {hasSecurityGate && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <Lock className="w-3 h-3" />
                            Security Gate
                          </span>
                        )}
                        {cashToReturn && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium border border-amber-300">
                            <Banknote className="w-3 h-3" />
                            Cash Return: TTD ${cashToReturnAmount}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {proofOfDelivery !== 'NONE' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <FileCheck className="w-4 h-4 text-teal-600" />
                        <span className="text-sm font-semibold text-gray-900">Proof of Delivery</span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                        {proofOfDelivery === 'PHOTO' && (
                          <>
                            <Camera className="w-3 h-3" />
                            Photo proof required
                          </>
                        )}
                        {proofOfDelivery === 'SIGNATURE' && (
                          <>
                            <FileCheck className="w-3 h-3" />
                            E-signature required
                          </>
                        )}
                        {proofOfDelivery === 'PHOTO_AND_SIGNATURE' && (
                          <>
                            <FileCheck className="w-3 h-3" />
                            Photo + E-signature
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {parsedCargoValue > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-gray-900">Cargo Value & Insurance</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          <DollarSign className="w-3 h-3" />
                          Declared: TTD ${parsedCargoValue.toLocaleString()}
                        </span>
                        {cargoInsuranceEnabled && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            <ShieldCheck className="w-3 h-3" />
                            Insured (+${insuranceFee.toFixed(2)})
                          </span>
                        )}
                        {isHighValue && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-bold border border-sky-300">
                            <Gem className="w-3 h-3" />
                            High Value
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6">Delivery Timing</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    When do you need this delivered? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('asap')}
                      className={`p-3 sm:p-6 rounded-lg border-2 transition-all ${
                        deliveryType === 'asap'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Zap className={`w-7 h-7 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 ${
                        deliveryType === 'asap' ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <p className={`font-bold text-sm sm:text-lg mb-1 ${
                        deliveryType === 'asap' ? 'text-blue-700' : 'text-gray-900'
                      }`}>ASAP Delivery</p>
                      <p className="text-xs sm:text-sm text-gray-600">Get it delivered as soon as possible</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryType('scheduled')}
                      className={`p-3 sm:p-6 rounded-lg border-2 transition-all ${
                        deliveryType === 'scheduled'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Calendar className={`w-7 h-7 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 ${
                        deliveryType === 'scheduled' ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <p className={`font-bold text-sm sm:text-lg mb-1 ${
                        deliveryType === 'scheduled' ? 'text-blue-700' : 'text-gray-900'
                      }`}>Scheduled Delivery</p>
                      <p className="text-xs sm:text-sm text-gray-600">Plan your pickup time</p>
                    </button>
                  </div>
                </div>


                {deliveryType === 'scheduled' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pickup Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={scheduledPickupDate}
                        onChange={(e) => setScheduledPickupDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pickup Time <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={pickupHour}
                          onChange={(e) => setPickupHour(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={h.toString()}>
                              {h}
                            </option>
                          ))}
                        </select>

                        <select
                          value={pickupMinute}
                          onChange={(e) => setPickupMinute(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                            <option key={m} value={m.toString().padStart(2, '0')}>
                              {m.toString().padStart(2, '0')}
                            </option>
                          ))}
                        </select>

                        <select
                          value={pickupPeriod}
                          onChange={(e) => setPickupPeriod(e.target.value as 'AM' | 'PM')}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6">Pricing Style</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    How would you like to price this job? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => setPricingType('fixed')}
                      className={`p-3 sm:p-6 rounded-lg border-2 transition-all relative ${
                        pricingType === 'fixed'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                        <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-green-500 text-white text-[10px] sm:text-xs font-bold rounded-full">
                          Likely to Book
                        </span>
                      </div>
                      <DollarSign className={`w-7 h-7 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 mt-4 sm:mt-0 ${
                        pricingType === 'fixed' ? 'text-green-600' : 'text-gray-400'
                      }`} />
                      <p className={`font-bold text-sm sm:text-lg mb-1 ${
                        pricingType === 'fixed' ? 'text-green-700' : 'text-gray-900'
                      }`}>Fixed Price</p>
                      <p className="text-xs sm:text-sm text-gray-600">Set your price, get quick acceptance</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPricingType('bid')}
                      className={`p-3 sm:p-6 rounded-lg border-2 transition-all relative ${
                        pricingType === 'bid'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                        <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-orange-500 text-white text-[10px] sm:text-xs font-bold rounded-full">
                          Auction Style
                        </span>
                      </div>
                      <Gavel className={`w-7 h-7 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 mt-4 sm:mt-0 ${
                        pricingType === 'bid' ? 'text-orange-600' : 'text-gray-400'
                      }`} />
                      <p className={`font-bold text-sm sm:text-lg mb-1 ${
                        pricingType === 'bid' ? 'text-orange-700' : 'text-gray-900'
                      }`}>Open to Bids</p>
                      <p className="text-xs sm:text-sm text-gray-600">Couriers compete, you choose best offer</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {pricingType === 'fixed' ? 'Your Price (TTD)' : 'Starting Bid / Budget (TTD)'} <span className="text-red-500">*</span>
                  </label>
                  {pricingType === 'fixed' && (
                    <p className="text-xs text-gray-600 mb-3">
                      Set your fixed price. Couriers can accept or pass on this job.
                    </p>
                  )}
                  {pricingType === 'bid' && (
                    <p className="text-xs text-gray-600 mb-3">
                      Set your budget or starting bid. Couriers will submit their offers, and you can choose the best one.
                    </p>
                  )}

                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setPriceInputMode('slider')}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium text-sm transition-all ${
                        priceInputMode === 'slider'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Recommended Range
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPriceInputMode('custom');
                        setCustomPriceInput(customerOffer.toString());
                      }}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium text-sm transition-all ${
                        priceInputMode === 'custom'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Custom Price
                    </button>
                  </div>

                  {priceInputMode === 'slider' ? (
                    <>
                      <input
                        type="range"
                        min={10}
                        max={Math.ceil((priceRec?.high || 200) * 1.5)}
                        step="5"
                        value={customerOffer}
                        onChange={(e) => setCustomerOffer(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-sm text-gray-600 mt-2">
                        <span>TTD $10</span>
                        <span className="text-2xl font-bold text-blue-600">TTD ${customerOffer}</span>
                        <span>TTD ${Math.ceil((priceRec?.high || 200) * 1.5)}</span>
                      </div>
                      {priceRec && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-600">
                            Recommended range: <span className="font-semibold text-gray-900">TTD ${priceRec.low} - ${priceRec.high}</span>
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">TTD $</span>
                        <input
                          type="number"
                          min="10"
                          step="10"
                          value={customPriceInput}
                          onChange={(e) => setCustomPriceInput(e.target.value)}
                          placeholder="Enter your price"
                          className="w-full pl-16 pr-4 py-4 text-2xl font-bold text-blue-600 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      {priceRec && customerOffer > 0 && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-600">
                            Recommended range: <span className="font-semibold text-gray-900">TTD ${priceRec.low} - ${priceRec.high}</span>
                            {customerOffer < priceRec.low && (
                              <span className="block mt-1 text-orange-600 font-medium">⚠️ Your price is below the recommended range</span>
                            )}
                            {customerOffer > priceRec.high * 1.2 && (
                              <span className="block mt-1 text-orange-600 font-medium">⚠️ Your price is significantly above the recommended range</span>
                            )}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {priceRec && likelihood && (
              <LikelihoodGraph
                score={likelihood.score}
                label={likelihood.label}
                breakdown={likelihood.breakdown}
                priceRecommendation={priceRec}
                customerOffer={customerOffer}
              />
            )}

            {customerOffer > 0 && (() => {
              const fees = calculateCustomerFees(customerOffer, platformFeePercent);
              const isJunk = jobType === 'junk_removal' && isNormalCustomer;
              const notOnCurbFee = isJunk && !junkCurbside ? JUNK_NOT_ON_CURB_FEE : 0;
              const extraHandFee = isJunk && junkNeedExtraHand ? JUNK_EXTRA_HAND_FEE : 0;
              const tippingFee = isJunk ? JUNK_TIPPING_FEE : 0;
              const junkExtras = notOnCurbFee + extraHandFee + tippingFee;
              const grandTotal = fees.customerTotal + insuranceFee + junkExtras;
              return (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Cost Breakdown</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-blue-200">
                      <span className="text-gray-700">Subtotal</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(fees.baseFare)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-blue-200">
                      <span className="text-gray-700">Platform Fee ({parseFloat((platformFeePercent * 100).toFixed(1))}%)</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(fees.platformFee)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-blue-200">
                      <span className="text-gray-700">VAT (12.5%)</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(fees.vatAmount)}</span>
                    </div>
                    {cargoInsuranceEnabled && insuranceFee > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-blue-200">
                        <span className="text-gray-700 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          Cargo Insurance
                        </span>
                        <span className="font-semibold text-emerald-700">{formatCurrency(insuranceFee)}</span>
                      </div>
                    )}
                    {isJunk && (
                      <div className="flex justify-between items-center py-2 border-b border-blue-200">
                        <span className="text-gray-700 flex items-center gap-1.5">
                          <Trash2 className="w-4 h-4 text-amber-600" />
                          Mandatory Landfill Tipping Fee
                        </span>
                        <span className="font-semibold text-amber-700">{formatCurrency(JUNK_TIPPING_FEE)}</span>
                      </div>
                    )}
                    {isJunk && !junkCurbside && (
                      <div className="flex justify-between items-center py-2 border-b border-blue-200">
                        <span className="text-gray-700 flex items-center gap-1.5">
                          <Dumbbell className="w-4 h-4 text-amber-600" />
                          Not on Curb Surcharge
                        </span>
                        <span className="font-semibold text-amber-700">{formatCurrency(JUNK_NOT_ON_CURB_FEE)}</span>
                      </div>
                    )}
                    {isJunk && junkNeedExtraHand && (
                      <div className="flex justify-between items-center py-2 border-b border-blue-200">
                        <span className="text-gray-700 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-blue-600" />
                          Extra Hand Helper
                        </span>
                        <span className="font-semibold text-blue-700">{formatCurrency(JUNK_EXTRA_HAND_FEE)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-3 bg-blue-600 -mx-4 px-4 -mb-4 sm:-mx-6 sm:px-6 sm:-mb-6 rounded-b-xl">
                      <span className="text-white font-bold text-base sm:text-lg">Total Paid</span>
                      <span className="font-bold text-white text-lg sm:text-xl">{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {!hasPaymentInfo && !checkingPayment && (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 mb-1">Payment Method Required</p>
                  <p className="text-sm text-amber-800">
                    You'll need to add a payment method before posting this job. Click "Post Job" to add your payment details.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
              </div>
            )}

            {userBusinessType === 'retail' && hasPreferredCouriers && (
              <div className="bg-white rounded-xl border-2 border-amber-200 overflow-hidden">
                <div className="p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendToPreferredFirst}
                      onChange={(e) => setSendToPreferredFirst(e.target.checked)}
                      className="w-5 h-5 text-amber-600 border-gray-300 rounded focus:ring-amber-500 mt-0.5"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold text-gray-900 text-sm">Send to Preferred Couriers First</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Your preferred couriers get a 5-minute head start before the job opens to all drivers. If no one accepts within 5 minutes, it automatically goes public.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs leading-relaxed text-slate-600">
                <span className="font-semibold text-slate-700">Delivery & Return Policy:</span> To protect our drivers' time, a strict 25-minute waiting grace period applies at drop-off. If the receiver is unavailable or the cargo is rejected upon arrival, you will be charged a 50% Return Fee to cover the driver's reverse trip. By posting this job, you agree to these terms.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(STEP_CARGO)}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || checkingPayment}
                className="flex-1 py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {editMode ? (loading ? 'Saving Changes...' : 'Save Changes') : (loading ? 'Creating Job...' : pricingType === 'bid' ? 'Post for Bids' : 'Post Job')}
              </button>
            </div>
          </div>
        )}
      </div>

      <AddPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setHasPaymentInfo(true);
          setShowPaymentModal(false);
          handleSubmit();
        }}
      />

      <SavedAddressPicker
        isOpen={showSavedAddressPicker}
        onClose={() => setShowSavedAddressPicker(false)}
        onSelect={(address) => {
          if (savedAddressTarget === 'pickup') {
            setPickup({
              text: address.text,
              lat: address.lat || 0,
              lng: address.lng || 0
            });
          } else {
            setDropoff({
              text: address.text,
              lat: address.lat || 0,
              lng: address.lng || 0
            });
          }
        }}
      />

      {showSaveAddressModal && saveAddressData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => { setShowSaveAddressModal(false); setSaveAddressData(null); }}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Save Address</h2>
                  <p className="text-sm text-gray-500">Add to your address book</p>
                </div>
              </div>
              <button onClick={() => { setShowSaveAddressModal(false); setSaveAddressData(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-gray-600 mb-1">Address</p>
                <p className="text-sm font-medium text-gray-900">{saveAddressData.address}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Give it a nickname</label>
                <input
                  type="text"
                  value={saveAddressLabel}
                  onChange={(e) => setSaveAddressLabel(e.target.value)}
                  placeholder="e.g., Home, Office, Warehouse"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={50}
                  disabled={savingAddress}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowSaveAddressModal(false); setSaveAddressData(null); }}
                disabled={savingAddress}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!user || !saveAddressLabel.trim()) return;
                  setSavingAddress(true);
                  try {
                    const { data: existing } = await supabase
                      .from('saved_addresses')
                      .select('id')
                      .eq('user_id', user.id)
                      .eq('address_text', saveAddressData.address)
                      .maybeSingle();

                    if (existing) {
                      await supabase.from('saved_addresses').update({ label: saveAddressLabel.trim() }).eq('id', existing.id);
                    } else {
                      await supabase.from('saved_addresses').insert({
                        user_id: user.id,
                        label: saveAddressLabel.trim(),
                        address_text: saveAddressData.address,
                        lat: saveAddressData.lat,
                        lng: saveAddressData.lng,
                      });
                    }

                    setShowSaveAddressModal(false);
                    setSaveAddressData(null);
                    setSaveAddressLabel('');
                  } catch (err) {
                    console.error('Error saving address:', err);
                  } finally {
                    setSavingAddress(false);
                  }
                }}
                disabled={!saveAddressLabel.trim() || savingAddress}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingAddress ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {savingAddress ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessNotification && (
        <NotificationToast
          message={successMessage}
          type="success"
          duration={3000}
          onClose={() => setShowSuccessNotification(false)}
        />
      )}
    </div>
  );
}
