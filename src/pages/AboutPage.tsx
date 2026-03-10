import {
  ArrowLeft,
  MapPin,
  DollarSign,
  ShieldCheck,
  Handshake,
  Truck,
  Target,
  Globe,
} from 'lucide-react';
import { MoveMeLogo } from '../components/MoveMeLogo';

interface AboutPageProps {
  onNavigate: (path: string) => void;
}

const highlights = [
  {
    icon: MapPin,
    title: 'Live GPS Tracking',
    description: 'Never ask "Where are you?" again. Watch your driver move on a live map from pickup to drop-off.',
    accent: 'bg-sky-50 text-sky-600',
  },
  {
    icon: DollarSign,
    title: 'Upfront TTD Pricing',
    description: 'No more haggling or surprise fees. Get an exact quote before you book, and pay securely from your phone.',
    accent: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: ShieldCheck,
    title: 'Vetted & Trusted Fleet',
    description: 'From agile motorcycle couriers to 3-ton heavy flatbeds, every MoveMeTT driver is background-checked, rated, and held to the highest standard.',
    accent: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Handshake,
    title: 'Safe Buy & B2B Solutions',
    description: 'We pioneered the "Safe Buy" proxy for secure marketplace shopping, and built a corporate dashboard with e-signatures and monthly invoicing.',
    accent: 'bg-rose-50 text-rose-600',
  },
];

export function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 animate-fade-in-up">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate('/more')}
            className="flex items-center gap-1.5 text-moveme-blue-600 hover:text-moveme-blue-700 font-medium mb-3 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">About MoveMeTT</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 px-6 py-10 flex flex-col items-center text-center">
            <MoveMeLogo className="h-12 w-auto [&>svg]:h-12 [&>svg]:w-auto mb-5 brightness-0 invert" />
            <p className="text-lg font-semibold text-white leading-snug max-w-md">
              Moving Trinidad & Tobago into the Digital Age.
            </p>
          </div>

          <div className="p-5 md:p-6 space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              For too long, moving goods in Trinidad & Tobago meant relying on guesswork. It meant calling "a guy with a van," haggling over prices, waiting hours without knowing where your cargo was, and crossing your fingers that your items would arrive safely.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              We knew T&T deserved better. We needed a system built on trust, transparency, and speed.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed font-medium">
              Enter MoveMeTT -- the country's premier on-demand logistics and transport marketplace. We aren't just a delivery app; we are the new digital operating system for moving anything across the islands. Whether you are a lawyer rushing a document across Port of Spain, a family buying a fridge off Facebook Marketplace, or a major hardware store dispatching 10 tons of cement to San Fernando, we put the power of a fully vetted fleet right in your pocket.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5 text-sky-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Our Mission</h2>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            To organize and digitize Caribbean logistics by connecting people and businesses with reliable, transparent, and trackable transport solutions.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">The MoveMeTT Difference</h2>
          <div className="grid gap-4">
            {highlights.map((item) => {
              const Icon = item.icon;
              const [bg, text] = item.accent.split(' ');
              return (
                <div key={item.title} className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-5 h-5 ${text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Built for the Roads of T&T</h2>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              MoveMeTT is not a foreign app trying to understand local roads -- it is a platform designed specifically for the realities of the Caribbean. We built systems to handle Trinidadian addresses, protect our drivers from wasted time, and ensure that whether it is rain or shine, your cargo is secured and delivered.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              We are empowering hundreds of independent local drivers to build their businesses, while giving consumers and retailers absolute peace of mind.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 md:p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Truck className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-white mb-1">Stop waiting. Start moving.</p>
          <p className="text-sm text-gray-400">Trinidad & Tobago's premier logistics platform</p>
        </div>

        <div className="text-center text-xs text-gray-400 pt-2 pb-4">
          <p className="font-medium">MoveMe TT v2.0.0</p>
          <p className="mt-1">2024 MoveMeTT Ltd. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
