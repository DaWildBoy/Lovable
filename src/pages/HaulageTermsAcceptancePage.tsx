import { useState, useRef, useEffect } from 'react';
import { Truck, ChevronDown, LogOut, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { HAULAGE_TERMS_VERSION, haulageSections } from '../components/HaulageTermsOfServiceModal';
import { MoveMeLogo } from '../components/MoveMeLogo';

interface Props {
  onAccepted: () => void;
  onBack?: () => void;
}

export function HaulageTermsAcceptancePage({ onAccepted, onBack }: Props) {
  const { user, signOut } = useAuth();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight - 40) {
        setScrolledToBottom(true);
      }
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAccept = async () => {
    if (!checked || !user) return;
    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: `haulage-${HAULAGE_TERMS_VERSION}`,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      onAccepted();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mr-3"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <MoveMeLogo className="h-10 w-auto [&>svg]:h-10 [&>svg]:w-auto" />
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-4 pt-6 md:pt-10">
        <div className="w-full max-w-3xl animate-fade-in-up">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 mb-4">
              <Truck className="w-7 h-7 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">
              Fleet Operator Terms of Service
            </h1>
            <p className="text-sm text-gray-500">
              Please review and accept the haulage operator terms to continue setting up your account
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                MoveMeTT Ltd. Fleet Operator Agreement
              </span>
              <span className="text-xs text-gray-400">Version {HAULAGE_TERMS_VERSION}</span>
            </div>

            <div
              ref={scrollRef}
              className="max-h-[50vh] overflow-y-auto p-5 space-y-5"
            >
              {haulageSections.map((section, i) => (
                <div key={i}>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">{section.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>

            {!scrolledToBottom && (
              <div className="flex justify-center py-2 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-1 text-xs text-gray-400 animate-bounce">
                  <ChevronDown className="w-3.5 h-3.5" />
                  Scroll down to read the full agreement
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
            <div className="flex items-start gap-3 mb-4">
              <input
                type="checkbox"
                id="haulage-terms-checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
              />
              <label htmlFor="haulage-terms-checkbox" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                I have read, understood, and agree to the{' '}
                <span className="font-semibold text-gray-900">MoveMeTT Fleet Operator Terms of Service</span>{' '}
                on behalf of my company. I acknowledge that my company and all registered drivers are bound by these terms for all jobs accepted through the Platform.
              </label>
            </div>

            {error && (
              <div className="p-3 bg-error-50 border border-error-200 rounded-xl mb-4 animate-fade-in">
                <p className="text-sm text-error-600 font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={!checked || saving}
              className="btn-primary w-full py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Accept & Continue to Subscription'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
