import { useAuth } from '../../contexts/AuthContext';
import { CustomerJobs } from '../customer/CustomerJobs';
import { CourierJobs } from '../courier/CourierJobs';

export function BusinessJobs({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { profile } = useAuth();

  if (profile?.business_type === 'haulage') {
    return <CourierJobs onNavigate={onNavigate} />;
  }

  return <CustomerJobs onNavigate={onNavigate} />;
}
