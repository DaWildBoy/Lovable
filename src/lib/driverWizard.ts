import { Database } from './database.types';

type DeliveryStop = Database['public']['Tables']['delivery_stops']['Row'];
type PodStop = Database['public']['Tables']['pod_stops']['Row'];

export interface DriverTask {
  taskId: string;
  type: 'PICKUP' | 'DROPOFF';
  index: number;
  displayLabel: string;
  address: string;
  lat: number | null;
  lng: number | null;
  contactName?: string;
  contactPhone?: string;
  status: 'NOT_STARTED' | 'ENROUTE' | 'ARRIVED' | 'COLLECTED' | 'DELIVERED';
  podRequirement: 'NONE' | 'PHOTO' | 'SIGNATURE' | 'PHOTO_AND_SIGNATURE';
  hasPodPhoto: boolean;
  hasPodSignature: boolean;
  cargoSummary?: string;
  stopId?: string;
}

export interface DriverWizardState {
  tasks: DriverTask[];
  currentTaskIndex: number;
  currentTask: DriverTask | null;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  isFinished: boolean;
  jobTypeLabel: 'Single Delivery' | 'Multi-Stop Delivery';
  routeType: 'FIXED' | 'FLEXIBLE';
  needsStopSelection: boolean;
  needsPickupSelection: boolean;
  needsStepChoice: boolean;
  selectionType: 'NONE' | 'PICKUP' | 'DROPOFF' | 'STEP_CHOICE';
  eligibleDropoffs: DriverTask[];
  remainingPickups: DriverTask[];
}

interface JobData {
  id: string;
  pickup_location_text: string;
  pickup_location_lat: number | null;
  pickup_location_lng: number | null;
  dropoff_location_text: string;
  dropoff_location_lat: number | null;
  dropoff_location_lng: number | null;
  delivery_stops?: DeliveryStop[];
  pod_stops?: PodStop[];
  proof_of_delivery_required?: string;
  route_type?: string;
  current_selected_stop_id?: string;
  cargo_items?: any[];
}

function mapStopStatusToTaskStatus(stopStatus: string): 'NOT_STARTED' | 'ENROUTE' | 'ARRIVED' | 'COLLECTED' | 'DELIVERED' {
  if (stopStatus === 'COMPLETED') return 'COLLECTED';
  if (stopStatus === 'ARRIVED') return 'ARRIVED';
  if (stopStatus === 'ENROUTE') return 'ENROUTE';
  return 'NOT_STARTED';
}

function mapDropoffStatusToTaskStatus(stopStatus: string): 'NOT_STARTED' | 'ENROUTE' | 'ARRIVED' | 'COLLECTED' | 'DELIVERED' {
  if (stopStatus === 'COMPLETED') return 'DELIVERED';
  if (stopStatus === 'ARRIVED') return 'ARRIVED';
  if (stopStatus === 'ENROUTE') return 'ENROUTE';
  return 'NOT_STARTED';
}

export function buildDriverWizardState(job: JobData): DriverWizardState {
  const tasks: DriverTask[] = [];

  const deliveryStops = job.delivery_stops || [];
  const pickupStops = deliveryStops.filter(s => s.stop_type === 'PICKUP');
  const dropoffStops = deliveryStops.filter(s => s.stop_type === 'DROPOFF');

  const routeType = (job.route_type as 'FIXED' | 'FLEXIBLE') || 'FIXED';
  const podRequired = (job.proof_of_delivery_required || 'NONE') as 'NONE' | 'PHOTO' | 'SIGNATURE' | 'PHOTO_AND_SIGNATURE';

  if (pickupStops.length > 0) {
    pickupStops.forEach((stop, idx) => {
      const podStop = job.pod_stops?.find(ps => ps.stop_id === stop.id);
      tasks.push({
        taskId: `pickup-${stop.id}`,
        type: 'PICKUP',
        index: idx + 1,
        displayLabel: `Pickup P${idx + 1}`,
        address: stop.location_text,
        lat: stop.location_lat,
        lng: stop.location_lng,
        contactName: stop.contact_name || undefined,
        contactPhone: stop.contact_phone || undefined,
        status: mapStopStatusToTaskStatus(stop.status),
        podRequirement: 'NONE',
        hasPodPhoto: false,
        hasPodSignature: false,
        stopId: stop.id
      });
    });
  } else {
    tasks.push({
      taskId: 'pickup-default',
      type: 'PICKUP',
      index: 1,
      displayLabel: 'Pickup',
      address: job.pickup_location_text,
      lat: job.pickup_location_lat,
      lng: job.pickup_location_lng,
      status: 'NOT_STARTED',
      podRequirement: 'NONE',
      hasPodPhoto: false,
      hasPodSignature: false
    });
  }

  if (dropoffStops.length > 0) {
    dropoffStops.forEach((stop, idx) => {
      const podStop = job.pod_stops?.find(ps => ps.stop_id === stop.id);
      const cargoForStop = job.cargo_items?.filter(
        item => item.dropoff_location_text === stop.location_text
      );
      const cargoCount = cargoForStop?.length || 0;

      tasks.push({
        taskId: `dropoff-${stop.id}`,
        type: 'DROPOFF',
        index: idx + 1,
        displayLabel: `Stop ${idx + 1}`,
        address: stop.location_text,
        lat: stop.location_lat,
        lng: stop.location_lng,
        contactName: stop.contact_name || undefined,
        contactPhone: stop.contact_phone || undefined,
        status: mapDropoffStatusToTaskStatus(stop.status),
        podRequirement: podRequired,
        hasPodPhoto: podStop?.photo_url ? true : false,
        hasPodSignature: podStop?.signature_data ? true : false,
        cargoSummary: cargoCount > 0 ? `${cargoCount} ${cargoCount === 1 ? 'item' : 'items'}` : undefined,
        stopId: stop.id
      });
    });
  } else {
    const podStop = job.pod_stops?.[0];
    tasks.push({
      taskId: 'dropoff-default',
      type: 'DROPOFF',
      index: 1,
      displayLabel: 'Delivery',
      address: job.dropoff_location_text,
      lat: job.dropoff_location_lat,
      lng: job.dropoff_location_lng,
      status: 'NOT_STARTED',
      podRequirement: podRequired,
      hasPodPhoto: podStop?.photo_url ? true : false,
      hasPodSignature: podStop?.signature_data ? true : false
    });
  }

  const completedTasks = tasks.filter(t =>
    (t.type === 'PICKUP' && t.status === 'COLLECTED') ||
    (t.type === 'DROPOFF' && t.status === 'DELIVERED')
  ).length;

  const pickupTasks = tasks.filter(t => t.type === 'PICKUP');
  const dropoffTasks = tasks.filter(t => t.type === 'DROPOFF');

  const allPickupsCollected = pickupTasks.every(t => t.status === 'COLLECTED');
  const anyPickupCollected = pickupTasks.some(t => t.status === 'COLLECTED');
  const anyPickupStarted = pickupTasks.some(t => t.status !== 'NOT_STARTED');
  const hasRemainingPickups = pickupTasks.some(t => t.status !== 'COLLECTED');
  const hasRemainingDropoffs = dropoffTasks.some(t => t.status !== 'DELIVERED');
  const isFinished = completedTasks === tasks.length;

  let currentTaskIndex = -1;
  let needsStopSelection = false;
  let needsPickupSelection = false;
  let needsStepChoice = false;
  let selectionType: 'NONE' | 'PICKUP' | 'DROPOFF' | 'STEP_CHOICE' = 'NONE';
  let eligibleDropoffs: DriverTask[] = [];
  let remainingPickups: DriverTask[] = [];

  // ═══════════════════════════════════════════════════════════
  // FLEXIBLE MODE - Driver chooses order
  // ═══════════════════════════════════════════════════════════
  if (routeType === 'FLEXIBLE') {
    // Calculate eligible options
    remainingPickups = pickupTasks.filter(t => t.status !== 'COLLECTED');
    eligibleDropoffs = anyPickupCollected
      ? dropoffTasks.filter(t => t.status !== 'DELIVERED')
      : [];

    // A) NO PICKUPS COLLECTED YET - Initial pickup phase
    if (!anyPickupCollected) {
      if (pickupTasks.length > 1) {
        // Multiple pickups - show selection
        if (!job.current_selected_stop_id) {
          needsPickupSelection = true;
          selectionType = 'PICKUP';
          currentTaskIndex = -1;
        } else {
          const selectedIndex = tasks.findIndex(t =>
            t.type === 'PICKUP' && t.stopId === job.current_selected_stop_id
          );
          if (selectedIndex !== -1 && tasks[selectedIndex].status !== 'COLLECTED') {
            currentTaskIndex = selectedIndex;
          } else {
            needsPickupSelection = true;
            selectionType = 'PICKUP';
            currentTaskIndex = -1;
          }
        }
      } else {
        // Single pickup - go directly to it
        currentTaskIndex = tasks.findIndex(t =>
          t.type === 'PICKUP' && t.status !== 'COLLECTED'
        );
      }
    }
    // B) AT LEAST ONE PICKUP COLLECTED - Driver has cargo, can choose next step
    else if (!isFinished && (hasRemainingPickups || hasRemainingDropoffs)) {
      if (!job.current_selected_stop_id) {
        // Show "Choose Next Step" with both pickup and dropoff options
        needsStepChoice = true;
        selectionType = 'STEP_CHOICE';
        currentTaskIndex = -1;
      } else {
        // A stop has been selected - find it and set as active
        const selectedIndex = tasks.findIndex(t => t.stopId === job.current_selected_stop_id);
        if (selectedIndex !== -1) {
          const selectedTask = tasks[selectedIndex];
          const isStillActive =
            (selectedTask.type === 'PICKUP' && selectedTask.status !== 'COLLECTED') ||
            (selectedTask.type === 'DROPOFF' && selectedTask.status !== 'DELIVERED');

          if (isStillActive) {
            currentTaskIndex = selectedIndex;
          } else {
            // Selected stop is done, return to choice
            needsStepChoice = true;
            selectionType = 'STEP_CHOICE';
            currentTaskIndex = -1;
          }
        } else {
          // Invalid selection, return to choice
          needsStepChoice = true;
          selectionType = 'STEP_CHOICE';
          currentTaskIndex = -1;
        }
      }
    }
  }
  // ═══════════════════════════════════════════════════════════
  // FIXED MODE - Sequential order (original logic)
  // ═══════════════════════════════════════════════════════════
  else {
    currentTaskIndex = tasks.findIndex(t => {
      if (t.type === 'PICKUP' && t.status !== 'COLLECTED') return true;
      if (t.type === 'DROPOFF' && t.status !== 'DELIVERED' && allPickupsCollected) return true;
      return false;
    });
  }

  const currentTask = currentTaskIndex >= 0 ? tasks[currentTaskIndex] : null;

  const pickupCount = tasks.filter(t => t.type === 'PICKUP').length;
  const dropoffCount = tasks.filter(t => t.type === 'DROPOFF').length;
  const jobTypeLabel: 'Single Delivery' | 'Multi-Stop Delivery' =
    (pickupCount === 1 && dropoffCount === 1) ? 'Single Delivery' : 'Multi-Stop Delivery';

  return {
    tasks,
    currentTaskIndex,
    currentTask,
    totalTasks: tasks.length,
    completedTasks,
    progressPercent: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0,
    isFinished,
    jobTypeLabel,
    routeType,
    needsStopSelection,
    needsPickupSelection,
    needsStepChoice,
    selectionType,
    eligibleDropoffs,
    remainingPickups
  };
}
