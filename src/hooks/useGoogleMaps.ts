import { useEffect, useState } from 'react';

interface GoogleMapsState {
  isLoaded: boolean;
  loadError: string | null;
}

export function useGoogleMaps(): GoogleMapsState {
  const [state, setState] = useState<GoogleMapsState>({
    isLoaded: !!window.google,
    loadError: null,
  });

  useEffect(() => {
    if (window.google) {
      setState({ isLoaded: true, loadError: null });
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found');
      setState({ isLoaded: false, loadError: 'no_api_key' });
      return;
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      const check = setInterval(() => {
        if (window.google) {
          setState({ isLoaded: true, loadError: null });
          clearInterval(check);
        }
      }, 100);
      return () => clearInterval(check);
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setState({ isLoaded: true, loadError: null });
    script.onerror = () => setState({ isLoaded: false, loadError: 'script_load_failed' });
    document.head.appendChild(script);
  }, []);

  return state;
}
