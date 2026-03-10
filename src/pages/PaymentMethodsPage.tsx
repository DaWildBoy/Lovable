import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, CreditCard, Plus, Trash2, Loader2, CheckCircle } from 'lucide-react';
import { AddPaymentModal } from '../components/AddPaymentModal';

interface PaymentMethodsPageProps {
  onNavigate: (path: string) => void;
}

export function PaymentMethodsPage({ onNavigate }: PaymentMethodsPageProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [hasCard, setHasCard] = useState(false);
  const [last4, setLast4] = useState('');

  const getProfilePath = () => {
    if (!profile) return '/';
    if (profile.role === 'customer') return '/customer/profile';
    if (profile.role === 'courier') return '/courier/profile';
    if (profile.role === 'business') {
      return profile.business_type === 'haulage' ? '/courier/profile' : '/business/profile';
    }
    return '/';
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('customer_payment_method, customer_payment_last4')
        .eq('id', profile.id)
        .maybeSingle();

      if (error) throw error;

      if (data && data.customer_payment_method) {
        setHasCard(true);
        setLast4(data.customer_payment_last4 || '');
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCard = async () => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          customer_payment_method: null,
          customer_payment_last4: null,
        })
        .eq('id', profile!.id);

      if (error) throw error;

      setHasCard(false);
      setLast4('');
    } catch (error) {
      console.error('Error removing payment method:', error);
      alert('Failed to remove payment method');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate(getProfilePath())}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Profile
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {!hasCard ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No payment methods added</h3>
            <p className="text-gray-600 mb-6">
              Add a credit or debit card to make payments easier
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Payment Method
            </button>
          </div>
        ) : (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Card
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">Credit Card</p>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-sm text-gray-600">•••• •••• •••• {last4}</p>
                  </div>
                  <button
                    onClick={handleRemoveCard}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddPaymentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          fetchPaymentMethods();
        }}
      />
    </div>
  );
}
