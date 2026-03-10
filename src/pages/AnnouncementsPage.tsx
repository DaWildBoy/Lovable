import { ArrowLeft, Megaphone, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AnnouncementsPageProps {
  onNavigate: (path: string) => void;
}

export function AnnouncementsPage({ onNavigate }: AnnouncementsPageProps) {
  const { profile } = useAuth();

  const getProfilePath = () => {
    if (!profile) return '/';
    if (profile.role === 'customer') return '/customer/profile';
    if (profile.role === 'courier') return '/courier/profile';
    if (profile.role === 'business') {
      return profile.business_type === 'haulage' ? '/courier/profile' : '/business/profile';
    }
    return '/';
  };

  const announcements = [
    {
      id: '1',
      title: 'Welcome to MoveMe TT',
      message: 'Thank you for choosing MoveMe TT for your delivery needs. We are committed to providing the best service possible.',
      date: '2024-01-15',
      type: 'info',
    },
    {
      id: '2',
      title: 'New Features Available',
      message: 'Check out our new multi-stop delivery feature and live tracking capabilities.',
      date: '2024-01-10',
      type: 'update',
    },
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-blue-100 text-blue-600';
      case 'update':
        return 'bg-green-100 text-green-600';
      case 'warning':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-600 mt-1">Latest updates and news</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Megaphone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No announcements at this time</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-full ${getTypeColor(
                      announcement.type
                    )} flex items-center justify-center flex-shrink-0`}
                  >
                    <Megaphone className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">{announcement.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{announcement.message}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {new Date(announcement.date).toLocaleDateString('en-TT', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
