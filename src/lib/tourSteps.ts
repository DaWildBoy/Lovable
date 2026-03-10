import type { TourStep } from '../components/GuidedTour';

export const customerTourSteps: TourStep[] = [
  {
    targetSelector: '[data-tour="create-delivery"]',
    title: 'Create a Delivery',
    description: 'Tap here to book a new delivery. Set pickup and dropoff locations, describe your cargo, and get instant price recommendations.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="stats-active"]',
    title: 'Active Deliveries',
    description: 'This shows your current active deliveries. Tap to see them in detail and track their progress in real-time.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="stats-pending"]',
    title: 'Pending Quotes',
    description: 'Deliveries waiting for courier bids appear here. You will receive quotes from available couriers and can accept the best offer.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="nav-jobs"]',
    title: 'My Jobs',
    description: 'View all your deliveries here -- active, pending, and completed. Message couriers, track live, and view proof of delivery.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-messages"]',
    title: 'Messages',
    description: 'Chat directly with your assigned courier. Share delivery instructions, photos, and get real-time updates.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-notifications"]',
    title: 'Notifications',
    description: 'Stay informed with alerts for new bids, delivery updates, and important notifications about your jobs.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-profile"]',
    title: 'Your Profile',
    description: 'Manage your account, payment methods, saved addresses, and app settings from here.',
    position: 'top',
  },
];

export const courierTourSteps: TourStep[] = [
  {
    targetSelector: '[data-tour="browse-jobs"]',
    title: 'Browse Available Jobs',
    description: 'Find delivery requests near you. View pickup/dropoff locations, cargo details, and offered prices. Place bids to win jobs.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="nav-jobs"]',
    title: 'My Jobs',
    description: 'Find your accepted and active deliveries here. Manage pickups, navigate to destinations, and upload proof of delivery.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-messages"]',
    title: 'Messages',
    description: 'Communicate with customers about their deliveries. Share updates, photos, and coordinate pickup details.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-notifications"]',
    title: 'Notifications',
    description: 'Get alerted about new job opportunities, delivery updates, and important account notifications.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-profile"]',
    title: 'Your Profile',
    description: 'View your ratings, manage bank details, set your home base, and adjust your account settings.',
    position: 'top',
  },
];

export const haulageTourSteps: TourStep[] = [
  {
    targetSelector: '[data-tour="fleet-overview"]',
    title: 'Fleet Overview',
    description: 'Monitor your entire fleet at a glance. See vehicle availability, active deliveries, and driver status in real-time.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="nav-jobs"]',
    title: 'Jobs & Dispatch',
    description: 'View incoming job requests, assign drivers and vehicles, and manage your company delivery operations.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-messages"]',
    title: 'Messages',
    description: 'Communicate with customers and your drivers. Coordinate deliveries and handle special requests.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-notifications"]',
    title: 'Notifications',
    description: 'Stay updated on new job assignments, driver updates, and important business alerts.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-profile"]',
    title: 'Company Profile',
    description: 'Manage your company details, fleet roster, driver approvals, subscription, and business settings.',
    position: 'top',
  },
];

export const retailTourSteps: TourStep[] = [
  {
    targetSelector: '[data-tour="create-delivery"]',
    title: 'Create a Delivery',
    description: 'Post new delivery jobs for your business. Set pickup from your store and dropoff to your customers.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="nav-jobs"]',
    title: 'Manage Jobs',
    description: 'Track all your business deliveries. View active, pending, and completed orders in one place.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-messages"]',
    title: 'Messages',
    description: 'Chat with couriers handling your deliveries. Provide special instructions and get live updates.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-notifications"]',
    title: 'Notifications',
    description: 'Receive alerts for new bids, delivery status changes, and important business notifications.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-profile"]',
    title: 'Business Profile',
    description: 'Manage your company details, saved locations, preferred couriers, delivery templates, and subscription.',
    position: 'top',
  },
];
