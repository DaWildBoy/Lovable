import { useState, useEffect } from 'react';
import { Save, HardHat, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export function RetailYardRules({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const [rules, setRules] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const MAX_CHARS = 2000;

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('yard_rules')
        .eq('id', profile.id)
        .maybeSingle();
      if (data?.yard_rules) {
        setRules(data.yard_rules);
        setCharCount(data.yard_rules.length);
      }
    })();
  }, [profile?.id]);

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ yard_rules: rules })
      .eq('id', profile.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChange = (val: string) => {
    if (val.length <= MAX_CHARS) {
      setRules(val);
      setCharCount(val.length);
      setSaved(false);
    }
  };

  const content = (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700 leading-relaxed">
          These rules will <strong>automatically attach to every job you post</strong>. Drivers must acknowledge them before pickup. Include PPE requirements, gate access codes, loading bay instructions, and any safety protocols.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
          <HardHat className="w-4 h-4 text-slate-500" />
          Mandatory Driver Instructions
        </label>
        <textarea
          value={rules}
          onChange={e => handleChange(e.target.value)}
          rows={10}
          placeholder={`Example:\n\n1. All drivers MUST wear steel-toed boots and high-vis vest on premises.\n2. Report to Gate B. Security code: Press intercom button #3.\n3. Loading bay hours: 6:00 AM - 6:00 PM only.\n4. No photography permitted inside warehouse.\n5. Maximum speed limit: 10 km/h on compound.\n6. All vehicles must reverse into loading bay.\n7. Contact dispatch at ext. 401 upon arrival.`}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed resize-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none placeholder:text-slate-300 bg-white"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-slate-400">
            {charCount} / {MAX_CHARS} characters
          </p>
          {charCount > MAX_CHARS * 0.9 && (
            <p className="text-xs text-amber-500 font-medium">Approaching character limit</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium animate-pulse">
              <Check className="w-4 h-4" />
              Rules saved successfully
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Rules'}
        </button>
      </div>
    </div>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
          <HardHat className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Yard Rules & Compliance</h2>
          <p className="text-sm text-gray-600">Driver instructions attached to every dispatch</p>
        </div>
      </div>
      {content}
    </div>
  );
}
