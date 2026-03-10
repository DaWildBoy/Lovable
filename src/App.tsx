import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { useGoogleMaps } from './hooks/useGoogleMaps';
import { isAdminUser } from './lib/adminAuth';
import { SignupPage } from './pages/SignupPage';
import { LoginPage } from './pages/LoginPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { CompleteProfilePage } from './pages/CompleteProfilePage';
import { CourierOnboardingPage } from './pages/CourierOnboardingPage';
import { HaulageOnboardingPage } from './pages/HaulageOnboardingPage';
import { SubscriptionSetupPage } from './pages/SubscriptionSetupPage';
import { PendingVerificationPage } from './pages/PendingVerificationPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminJobs } from './pages/admin/AdminJobs';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminCompanies } from './pages/admin/AdminCompanies';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminMessages } from './pages/admin/AdminMessages';
import { AdminRevenue } from './pages/admin/AdminRevenue';
import { AdminProfile } from './pages/admin/AdminProfile';
import { AdminInvoices } from './pages/admin/AdminInvoices';
import { AdminCompanySettings } from './pages/admin/AdminCompanySettings';
import { AdminBroadcast } from './pages/admin/AdminBroadcast';
import { AdminAuditLog } from './pages/admin/AdminAuditLog';
import { AdminSupport } from './pages/admin/AdminSupport';
import { CreateJobPage } from './pages/CreateJobPage';
import { JobDetailsPage } from './pages/JobDetailsPage';
import { CustomerHome } from './pages/customer/CustomerHome';
import { CustomerJobs } from './pages/customer/CustomerJobs';
import { CustomerMessages } from './pages/customer/CustomerMessages';
import { CustomerProfile } from './pages/customer/CustomerProfile';
import { CustomerNotifications } from './pages/customer/CustomerNotifications';
import { CustomerPreferencesPage } from './pages/customer/CustomerPreferencesPage';
import { CustomerSecurityPage } from './pages/customer/CustomerSecurityPage';
import { CourierHome } from './pages/courier/CourierHome';
import { CourierJobs } from './pages/courier/CourierJobs';
import { CourierMessages } from './pages/courier/CourierMessages';
import { CourierProfile } from './pages/courier/CourierProfile';
import { CourierNotifications } from './pages/courier/CourierNotifications';
import { CourierDashboard } from './pages/CourierDashboard';
import { BusinessHome } from './pages/business/BusinessHome';
import { BusinessJobs } from './pages/business/BusinessJobs';
import { BusinessMessages } from './pages/business/BusinessMessages';
import { BusinessProfile } from './pages/business/BusinessProfile';
import { BusinessNotifications } from './pages/business/BusinessNotifications';
import { SettingsPage } from './pages/SettingsPage';
import { AddressBookPage } from './pages/AddressBookPage';
import { WalletPage } from './pages/WalletPage';
import { PaymentMethodsPage } from './pages/PaymentMethodsPage';
import { SupportPage } from './pages/SupportPage';
import { ChatSupportPage } from './pages/ChatSupportPage';
import { ProfileEditPage } from './pages/ProfileEditPage';
import { VerificationPage } from './pages/VerificationPage';
import { SettingsMainPage } from './pages/SettingsMainPage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';
import { LanguageSettingsPage } from './pages/LanguageSettingsPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { MorePage } from './pages/MorePage';
import { AboutPage } from './pages/AboutPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { CompanyDriverHome } from './pages/company-driver/CompanyDriverHome';
import { CompanyDriverJobs } from './pages/company-driver/CompanyDriverJobs';
import { CompanyDriverProfile } from './pages/company-driver/CompanyDriverProfile';
import { HaulageJobs } from './pages/haulage/HaulageJobs';
import { RetailTermsAcceptancePage } from './pages/RetailTermsAcceptancePage';
import { HaulageTermsAcceptancePage } from './pages/HaulageTermsAcceptancePage';
import { CourierTermsAcceptancePage } from './pages/CourierTermsAcceptancePage';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { LoadingScreen } from './components/LoadingScreen';
import { TwoFactorChallenge } from './components/TwoFactorChallenge';

function AppContent() {
  const { user, profile, loading, profileError, signOut, refreshProfile, mfaRequired, mfaVerified } = useAuth();
  const { isLoaded: mapsLoaded, loadError: mapsError } = useGoogleMaps();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname + window.location.search);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [courierStatusChecked, setCourierStatusChecked] = useState(false);
  const [courierHasOnboarded, setCourierHasOnboarded] = useState(false);
  const [courierIsVerified, setCourierIsVerified] = useState(false);
  const [retailTermsAccepted, setRetailTermsAccepted] = useState(false);
  const [retailTermsChecked, setRetailTermsChecked] = useState(false);
  const [haulageTermsAccepted, setHaulageTermsAccepted] = useState(false);
  const [haulageTermsChecked, setHaulageTermsChecked] = useState(false);
  const [courierTermsAccepted, setCourierTermsAccepted] = useState(false);
  const [courierTermsChecked, setCourierTermsChecked] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('AppContent profile state:', {
      profile,
      first_name: profile?.first_name,
      phone: profile?.phone,
      role: profile?.role,
      business_type: profile?.business_type,
      company_name: profile?.company_name
    });
  }, [profile]);

  useEffect(() => {
    if (user && profile?.role === 'business' && (profile.business_type === 'haulage' || profile.business_type === 'retail')) {
      supabase
        .from('business_subscriptions')
        .select('id, status')
        .eq('business_user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setHasSubscription(!!data && data.status !== 'pending_payment_info');
          setSubscriptionChecked(true);
        });
    } else {
      setSubscriptionChecked(true);
      setHasSubscription(true);
    }
  }, [user, profile?.role, profile?.business_type]);

  useEffect(() => {
    if (user && profile?.role === 'business' && profile.business_type === 'retail') {
      setRetailTermsAccepted(!!profile.terms_accepted_at);
      setRetailTermsChecked(true);
    } else {
      setRetailTermsAccepted(true);
      setRetailTermsChecked(true);
    }
  }, [user, profile?.role, profile?.business_type, profile?.terms_accepted_at]);

  useEffect(() => {
    if (user && profile?.role === 'business' && profile.business_type === 'haulage') {
      setHaulageTermsAccepted(!!profile.terms_accepted_at);
      setHaulageTermsChecked(true);
    } else {
      setHaulageTermsAccepted(true);
      setHaulageTermsChecked(true);
    }
  }, [user, profile?.role, profile?.business_type, profile?.terms_accepted_at]);

  useEffect(() => {
    if (user && profile?.role === 'courier') {
      setCourierTermsAccepted(!!(profile as any).courier_terms_accepted_at);
      setCourierTermsChecked(true);
    } else {
      setCourierTermsAccepted(true);
      setCourierTermsChecked(true);
    }
  }, [user, profile?.role, (profile as any)?.courier_terms_accepted_at]);

  useEffect(() => {
    if (user && profile?.role === 'courier') {
      supabase
        .from('couriers')
        .select('id, verified, verification_status')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setCourierHasOnboarded(!!data);
          setCourierIsVerified(!!data?.verified && data?.verification_status === 'approved');
          setCourierStatusChecked(true);
        });
    } else {
      setCourierStatusChecked(true);
      setCourierHasOnboarded(true);
      setCourierIsVerified(true);
    }
  }, [user, profile?.role]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname + window.location.search);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
  };

  if (loading) {
    return <LoadingScreen message="Loading MoveMe TT..." />;
  }

  if (!user) {
    return authMode === 'signup' ? (
      <SignupPage onSwitchToLogin={() => setAuthMode('login')} />
    ) : (
      <LoginPage onSwitchToSignup={() => setAuthMode('signup')} />
    );
  }

  if (mfaRequired) {
    return (
      <TwoFactorChallenge
        onVerified={mfaVerified}
        onCancel={async () => {
          await signOut();
          setAuthMode('login');
        }}
      />
    );
  }

  // Show error if profile failed to load
  if (profileError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Profile Load Error</h2>
          <p className="text-gray-600 mb-6">{profileError}</p>
          <div className="flex gap-3">
            <button
              onClick={refreshProfile}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={signOut}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user.email_confirmed_at) {
    return <EmailVerificationPage />;
  }

  if (!profile) {
    return <LoadingScreen message="Loading your profile..." />;
  }

  if (isAdminUser(profile)) {
    const renderAdminPage = () => {
      const adminPath = currentPath.split('?')[0];
      if (adminPath === '/admin/jobs') return <AdminJobs />;
      if (adminPath === '/admin/users') return <AdminUsers />;
      if (adminPath === '/admin/companies') return <AdminCompanies />;
      if (adminPath === '/admin/messages') return <AdminMessages />;
      if (adminPath === '/admin/invoices') return <AdminInvoices />;
      if (adminPath === '/admin/revenue') return <AdminRevenue />;
      if (adminPath === '/admin/broadcast') return <AdminBroadcast />;
      if (adminPath === '/admin/branding') return <AdminCompanySettings />;
      if (adminPath === '/admin/settings') return <AdminSettings />;
      if (adminPath === '/admin/profile') return <AdminProfile />;
      if (adminPath === '/admin/audit') return <AdminAuditLog />;
      if (adminPath === '/admin/support') return <AdminSupport />;
      return <AdminDashboard onNavigate={navigate} />;
    };

    return (
      <AdminLayout currentPath={currentPath} onNavigate={navigate}>
        {renderAdminPage()}
      </AdminLayout>
    );
  }

  if (profile && (!profile.first_name || !profile.phone)) {
    return <CompleteProfilePage />;
  }

  if (profile?.role === 'courier') {
    if (!courierStatusChecked) {
      return <LoadingScreen message="Checking verification status..." />;
    }
    if (!courierHasOnboarded) {
      return <CourierOnboardingPage />;
    }
    if (!courierTermsChecked) {
      return <LoadingScreen message="Checking terms acceptance..." />;
    }
    if (!courierTermsAccepted) {
      return (
        <CourierTermsAcceptancePage
          onAccepted={() => {
            setCourierTermsAccepted(true);
            refreshProfile();
          }}
        />
      );
    }
    if (!courierIsVerified) {
      return <PendingVerificationPage type="courier" />;
    }
  }

  if (profile?.role === 'business' && !profile.business_type) {
    return <CompleteProfilePage />;
  }

  if (profile?.role === 'business' && profile.business_type === 'haulage' && !profile.haulage_onboarding_completed) {
    return <HaulageOnboardingPage />;
  }

  if (profile?.role === 'business' && profile.business_type === 'haulage' && profile.business_verification_status !== 'approved') {
    return <PendingVerificationPage type="haulage" />;
  }

  if (profile?.role === 'business' && profile.business_type === 'haulage') {
    if (!haulageTermsChecked) {
      return <LoadingScreen message="Checking terms acceptance..." />;
    }
    if (!haulageTermsAccepted) {
      return (
        <HaulageTermsAcceptancePage
          onAccepted={() => {
            setHaulageTermsAccepted(true);
            refreshProfile();
          }}
          onBack={async () => {
            if (user) {
              await supabase.from('profiles').update({
                haulage_onboarding_completed: false,
              }).eq('id', user.id);
              await refreshProfile();
            }
          }}
        />
      );
    }
  }

  if (profile?.role === 'business' && profile.business_type === 'retail') {
    if (!retailTermsChecked) {
      return <LoadingScreen message="Checking terms acceptance..." />;
    }
    if (!retailTermsAccepted) {
      return (
        <RetailTermsAcceptancePage
          onAccepted={() => {
            setRetailTermsAccepted(true);
            refreshProfile();
          }}
          onBack={async () => {
            if (user) {
              await supabase.from('profiles').update({
                business_type: null,
                business_verified: false,
                business_verification_status: null,
              }).eq('id', user.id);
              await refreshProfile();
            }
          }}
        />
      );
    }
  }

  if (profile?.role === 'business' && (profile.business_type === 'haulage' || profile.business_type === 'retail')) {
    if (!subscriptionChecked) {
      return <LoadingScreen message="Checking subscription..." />;
    }
    if (!hasSubscription) {
      return (
        <SubscriptionSetupPage
          onBack={async () => {
            if (user) {
              await supabase.from('profiles').update({ terms_accepted_at: null, terms_version: null }).eq('id', user.id);
              if (profile.business_type === 'retail') {
                setRetailTermsAccepted(false);
              } else {
                setHaulageTermsAccepted(false);
              }
            }
          }}
        />
      );
    }
  }

  if (!mapsLoaded && !mapsError && (currentPath === '/create-job' || currentPath.startsWith('/job/'))) {
    return <LoadingScreen message="Loading maps..." />;
  }

  const renderPage = () => {
    const pathWithoutQuery = currentPath.split('?')[0];

    if (pathWithoutQuery.startsWith('/admin')) {
      const homeRoute = profile?.role === 'business'
        ? (profile?.business_type === 'retail' ? '/business' : '/courier')
        : profile?.role === 'courier' ? '/courier' : '/customer';

      setTimeout(() => navigate(homeRoute), 2000);
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white rounded-2xl shadow-card border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 bg-error-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Access Denied</h2>
            <p className="text-sm text-gray-500">You do not have permission to view this page. Redirecting...</p>
          </div>
        </div>
      );
    }

    if (pathWithoutQuery === '/create-job') {
      const backRoute = profile?.role === 'business'
        ? (profile?.business_type === 'retail' ? '/business' : '/courier')
        : profile?.role === 'customer' ? '/customer' : '/courier';

      return (
        <CreateJobPage
          onBack={() => navigate(backRoute)}
          onJobCreated={() => navigate(backRoute)}
        />
      );
    }

    if (pathWithoutQuery.startsWith('/job/') && pathWithoutQuery.includes('/edit')) {
      const jobId = pathWithoutQuery.split('/')[2];
      const backRoute = `/job/${jobId}`;

      return (
        <CreateJobPage
          editJobId={jobId}
          onBack={() => navigate(backRoute)}
          onJobCreated={() => navigate(backRoute)}
        />
      );
    }

    if (pathWithoutQuery.startsWith('/job/')) {
      const jobId = pathWithoutQuery.split('/')[2];
      const backRoute = profile?.role === 'business'
        ? (profile?.business_type === 'retail' ? '/business/jobs' : '/courier/jobs')
        : profile?.role === 'courier' ? '/courier/jobs' : '/customer/jobs';

      return (
        <JobDetailsPage
          jobId={jobId}
          onBack={() => navigate(backRoute)}
          onEdit={(jobId) => navigate(`/job/${jobId}/edit`)}
        />
      );
    }

    if (profile?.role === 'customer') {
      if (pathWithoutQuery === '/customer' || pathWithoutQuery === '/') return <CustomerHome onNavigate={navigate} />;
      if (pathWithoutQuery === '/customer/jobs') return <CustomerJobs key={currentPath} onNavigate={navigate} />;
      if (pathWithoutQuery === '/customer/notifications') return <CustomerNotifications onNavigate={navigate} />;
      if (pathWithoutQuery === '/customer/messages') return <CustomerMessages onNavigate={navigate} />;
      if (pathWithoutQuery === '/customer/profile') return <CustomerProfile onNavigate={navigate} />;
      if (pathWithoutQuery === '/customer/settings') return <SettingsPage onBack={() => navigate('/customer/profile')} />;
      if (pathWithoutQuery === '/customer/preferences') return <CustomerPreferencesPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/customer/security') return <CustomerSecurityPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/address-book') return <AddressBookPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/wallet') return <WalletPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/payment-methods') return <PaymentMethodsPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/support') return <SupportPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/support/chat') return <ChatSupportPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/notifications') return <CustomerNotifications onNavigate={navigate} />;
      if (pathWithoutQuery === '/profile/edit') return <ProfileEditPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/verification') return <VerificationPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/settings') return <SettingsMainPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/settings/notifications') return <NotificationSettingsPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/settings/language') return <LanguageSettingsPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/announcements') return <AnnouncementsPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/more') return <MorePage onNavigate={navigate} />;
      if (pathWithoutQuery === '/about') return <AboutPage onNavigate={navigate} />;
      return <CustomerHome onNavigate={navigate} />;
    }

    if (profile?.role === 'courier') {
      const isCompanyDriver = !!(profile as any).is_company_driver;

      if (isCompanyDriver) {
        if (pathWithoutQuery === '/courier' || pathWithoutQuery === '/') return <CompanyDriverHome onNavigate={navigate} />;
        if (pathWithoutQuery === '/courier/jobs') return <CourierJobs key={currentPath} onNavigate={navigate} />;
        if (pathWithoutQuery === '/courier/notifications') return <CourierNotifications onNavigate={navigate} />;
        if (pathWithoutQuery === '/courier/messages') return <CourierMessages onNavigate={navigate} />;
        if (pathWithoutQuery === '/courier/profile') return <CompanyDriverProfile onNavigate={navigate} />;
        if (pathWithoutQuery === '/courier/settings') return <SettingsPage onBack={() => navigate('/courier/profile')} />;
        if (pathWithoutQuery === '/support') return <SupportPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/support/chat') return <ChatSupportPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/notifications') return <CourierNotifications onNavigate={navigate} />;
        if (pathWithoutQuery === '/profile/edit') return <ProfileEditPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/settings') return <SettingsMainPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/settings/notifications') return <NotificationSettingsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/settings/language') return <LanguageSettingsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/announcements') return <AnnouncementsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/more') return <MorePage onNavigate={navigate} />;
        if (pathWithoutQuery === '/about') return <AboutPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/wallet' || pathWithoutQuery === '/payment-methods' || pathWithoutQuery === '/address-book') {
          return <CompanyDriverHome onNavigate={navigate} />;
        }
        return <CompanyDriverHome onNavigate={navigate} />;
      }

      if (pathWithoutQuery === '/courier' || pathWithoutQuery === '/') return <CourierHome onNavigate={navigate} />;
      if (pathWithoutQuery === '/courier/jobs') return <CourierJobs key={currentPath} onNavigate={navigate} />;
      if (pathWithoutQuery === '/courier/notifications') return <CourierNotifications onNavigate={navigate} />;
      if (pathWithoutQuery === '/courier/messages') return <CourierMessages onNavigate={navigate} />;
      if (pathWithoutQuery === '/courier/profile') return <CourierProfile onNavigate={navigate} />;
      if (pathWithoutQuery === '/courier/settings') return <SettingsPage onBack={() => navigate('/courier/profile')} />;
      if (pathWithoutQuery === '/address-book') return <AddressBookPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/wallet') return <WalletPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/payment-methods') return <PaymentMethodsPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/support') return <SupportPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/support/chat') return <ChatSupportPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/notifications') return <CourierNotifications onNavigate={navigate} />;
      if (pathWithoutQuery === '/profile/edit') return <ProfileEditPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/verification') return <VerificationPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/settings') return <SettingsMainPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/settings/notifications') return <NotificationSettingsPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/settings/language') return <LanguageSettingsPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/announcements') return <AnnouncementsPage onNavigate={navigate} />;
      if (pathWithoutQuery === '/more') return <MorePage onNavigate={navigate} />;
      if (pathWithoutQuery === '/about') return <AboutPage onNavigate={navigate} />;
      return <CourierHome onNavigate={navigate} />;
    }

    if (profile?.role === 'business') {
      if (profile?.business_type === 'haulage') {
        if (pathWithoutQuery === '/courier' || pathWithoutQuery === '/' || pathWithoutQuery === '/business') return <BusinessHome onNavigate={navigate} />;
        if (pathWithoutQuery === '/courier/jobs' || pathWithoutQuery === '/business/jobs') return <HaulageJobs key={currentPath} onNavigate={navigate} />;
        if (pathWithoutQuery === '/courier/notifications' || pathWithoutQuery === '/business/notifications') return <CourierNotifications onNavigate={navigate} />;
        if (pathWithoutQuery === '/courier/messages' || pathWithoutQuery === '/business/messages') return <CourierMessages onNavigate={navigate} />;
        if (pathWithoutQuery === '/courier/profile' || pathWithoutQuery === '/business/profile') return <BusinessProfile onNavigate={navigate} />;
        if (pathWithoutQuery === '/courier/settings' || pathWithoutQuery === '/business/settings') return <SettingsPage onBack={() => navigate('/business/profile')} />;
        if (pathWithoutQuery === '/subscription') return <SubscriptionPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/address-book') return <AddressBookPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/wallet') return <WalletPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/payment-methods') return <PaymentMethodsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/support') return <SupportPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/support/chat') return <ChatSupportPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/notifications') return <CourierNotifications onNavigate={navigate} />;
        if (pathWithoutQuery === '/profile/edit') return <ProfileEditPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/verification') return <VerificationPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/settings') return <SettingsMainPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/settings/notifications') return <NotificationSettingsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/settings/language') return <LanguageSettingsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/announcements') return <AnnouncementsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/more') return <MorePage onNavigate={navigate} />;
        if (pathWithoutQuery === '/about') return <AboutPage onNavigate={navigate} />;
        return <BusinessHome onNavigate={navigate} />;
      } else {
        if (pathWithoutQuery === '/business' || pathWithoutQuery === '/') return <BusinessHome onNavigate={navigate} />;
        if (pathWithoutQuery === '/business/jobs') return <BusinessJobs key={currentPath} onNavigate={navigate} />;
        if (pathWithoutQuery === '/business/notifications') return <BusinessNotifications onNavigate={navigate} />;
        if (pathWithoutQuery === '/business/messages') return <BusinessMessages onNavigate={navigate} />;
        if (pathWithoutQuery === '/business/profile') return <BusinessProfile onNavigate={navigate} />;
        if (pathWithoutQuery === '/business/settings') return <SettingsPage onBack={() => navigate('/business/profile')} />;
        if (pathWithoutQuery === '/subscription') return <SubscriptionPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/address-book') return <AddressBookPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/wallet') return <WalletPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/payment-methods') return <PaymentMethodsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/support') return <SupportPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/support/chat') return <ChatSupportPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/notifications') return <BusinessNotifications onNavigate={navigate} />;
        if (pathWithoutQuery === '/profile/edit') return <ProfileEditPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/verification') return <VerificationPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/settings') return <SettingsMainPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/settings/notifications') return <NotificationSettingsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/settings/language') return <LanguageSettingsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/announcements') return <AnnouncementsPage onNavigate={navigate} />;
        if (pathWithoutQuery === '/more') return <MorePage onNavigate={navigate} />;
        if (pathWithoutQuery === '/about') return <AboutPage onNavigate={navigate} />;
        return <BusinessHome onNavigate={navigate} />;
      }
    }

    return <div>Page not found</div>;
  };

  const showNavigation = !currentPath.startsWith('/create-job') && !currentPath.startsWith('/job/');

  return (
    <div className="min-h-screen bg-gray-50">
      {showNavigation && <Sidebar currentPath={currentPath} onNavigate={navigate} />}
      <div className={showNavigation ? 'md:ml-64' : ''}>
        {renderPage()}
      </div>
      {showNavigation && <BottomNav currentPath={currentPath} onNavigate={navigate} />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
