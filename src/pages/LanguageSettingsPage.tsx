import { useState } from 'react';
import { ArrowLeft, CheckCircle, Globe } from 'lucide-react';

interface LanguageSettingsPageProps {
  onNavigate: (path: string) => void;
}

export function LanguageSettingsPage({ onNavigate }: LanguageSettingsPageProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('en-TT');

  const languages = [
    { code: 'en-TT', name: 'English (Trinidad & Tobago)', flag: '🇹🇹' },
    { code: 'en-US', name: 'English (United States)', flag: '🇺🇸' },
    { code: 'en-GB', name: 'English (United Kingdom)', flag: '🇬🇧' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
  ];

  const handleLanguageChange = (code: string) => {
    setSelectedLanguage(code);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate('/settings')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Settings
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Language</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {languages.map((language, index) => {
            const isSelected = selectedLanguage === language.code;
            const isLast = index === languages.length - 1;

            return (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-all text-left ${
                  !isLast ? 'border-b border-gray-200' : ''
                }`}
              >
                <div className="text-3xl">{language.flag}</div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{language.name}</p>
                </div>
                {isSelected && <CheckCircle className="w-5 h-5 text-blue-600" />}
              </button>
            );
          })}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">Language selection</p>
              <p>
                Your selected language will be used throughout the app. Some features may not be
                available in all languages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
