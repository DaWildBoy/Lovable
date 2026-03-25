import { useState, useEffect } from 'react';
import { Star, UserPlus, Trash2, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface PreferredCourier {
  id: string;
  courier_profile_id: string;
  notes: string | null;
  courier: {
    full_name: string;
    avatar_url: string | null;
    company_name: string | null;
  };
}

interface CourierSearchResult {
  id: string;
  full_name: string;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
}

interface RetailPreferredCouriersProps {
  embedded?: boolean;
}

export function RetailPreferredCouriers({ embedded = false }: RetailPreferredCouriersProps) {
  const { profile } = useAuth();
  const [preferredCouriers, setPreferredCouriers] = useState<PreferredCourier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CourierSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchPreferredCouriers();
  }, [profile]);

  const fetchPreferredCouriers = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('retail_preferred_couriers')
        .select(`
          id,
          courier_profile_id,
          notes,
          courier:profiles!retail_preferred_couriers_courier_profile_id_fkey(
            full_name,
            avatar_url,
            company_name
          )
        `)
        .eq('retail_profile_id', profile.id);

      if (error) throw error;
      setPreferredCouriers(data || []);
    } catch (error) {
      console.error('Error fetching preferred couriers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, company_name, role')
        .or(`role.eq.courier,role.eq.business`)
        .ilike('full_name', `%${searchQuery}%`)
        .limit(10);

      if (error) throw error;

      const existingIds = preferredCouriers.map(pc => pc.courier_profile_id);
      const filtered = (data || []).filter(c => !existingIds.includes(c.id) && c.id !== profile?.id);

      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching couriers:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddPreferred = async (courierId: string) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('retail_preferred_couriers')
        .insert({
          retail_profile_id: profile.id,
          courier_profile_id: courierId,
        });

      if (error) throw error;

      await fetchPreferredCouriers();
      setShowAddModal(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding preferred courier:', error);
      alert('Failed to add preferred courier');
    }
  };

  const handleRemove = async (preferredCourierId: string) => {
    if (!confirm('Remove this courier from your preferred list?')) return;

    try {
      const { error } = await supabase
        .from('retail_preferred_couriers')
        .delete()
        .eq('id', preferredCourierId);

      if (error) throw error;
      await fetchPreferredCouriers();
    } catch (error) {
      console.error('Error removing preferred courier:', error);
      alert('Failed to remove preferred courier');
    }
  };

  if (loading) {
    return (
      <div className={embedded ? '' : 'bg-white rounded-xl shadow-sm border border-gray-200 p-6'}>
        <div className="text-center text-gray-500 py-4">Loading preferred couriers...</div>
      </div>
    );
  }

  const addBtn = (
    <button
      onClick={() => setShowAddModal(true)}
      className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all text-sm font-medium"
    >
      <UserPlus className="w-4 h-4" />
      Add Courier
    </button>
  );

  const listContent = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Preferred Couriers</h2>
              <p className="text-sm text-gray-600">Mark your favorite delivery providers</p>
            </div>
          </div>
          {addBtn}
        </div>
      )}
      {embedded && (
        <div className="flex justify-end mb-4">
          {addBtn}
        </div>
      )}

      {preferredCouriers.length === 0 ? (
        <div className="text-center py-8">
          <Star className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">No preferred couriers yet</p>
          <p className="text-sm text-gray-500">
            Mark couriers as preferred to easily identify them when reviewing bids
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {preferredCouriers.map((pc) => (
            <div
              key={pc.id}
              className="flex items-center gap-4 border border-gray-200 rounded-lg p-4 hover:border-yellow-300 transition-all"
            >
              {pc.courier.avatar_url ? (
                <img
                  src={pc.courier.avatar_url}
                  alt={pc.courier.full_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 font-semibold">
                    {pc.courier.full_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{pc.courier.full_name}</h3>
                {pc.courier.company_name && (
                  <p className="text-sm text-gray-600">{pc.courier.company_name}</p>
                )}
                {pc.notes && (
                  <p className="text-xs text-gray-500 italic mt-1">{pc.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                  <Star className="w-3 h-3 fill-current" />
                  Preferred
                </div>
                <button
                  onClick={() => handleRemove(pc.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-700">
          <strong>Note:</strong> Preferred couriers will be visually highlighted when viewing bids and offers. This does not affect bidding or auto-assignment.
        </p>
      </div>
    </>
  );

  return (
    <>
      {embedded ? (
        <div>{listContent}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {listContent}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Add Preferred Courier</h3>
            </div>

            <div className="p-6">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Search by name..."
                />
              </div>

              {searching && (
                <div className="text-center py-4 text-gray-500">Searching...</div>
              )}

              {!searching && searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((courier) => (
                    <button
                      key={courier.id}
                      onClick={() => handleAddPreferred(courier.id)}
                      className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all text-left"
                    >
                      {courier.avatar_url ? (
                        <img
                          src={courier.avatar_url}
                          alt={courier.full_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-semibold">
                            {courier.full_name?.charAt(0) || '?'}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{courier.full_name}</p>
                        {courier.company_name && (
                          <p className="text-sm text-gray-600">{courier.company_name}</p>
                        )}
                      </div>
                      <UserPlus className="w-5 h-5 text-yellow-600" />
                    </button>
                  ))}
                </div>
              )}

              {!searching && searchQuery && searchResults.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No couriers found matching "{searchQuery}"
                </div>
              )}

              {!searchQuery && (
                <div className="text-center py-8 text-gray-500">
                  Start typing to search for couriers
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
