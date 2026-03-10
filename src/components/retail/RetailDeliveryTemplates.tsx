import { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface DeliveryTemplate {
  id: string;
  template_name: string;
  pickup_locations: any[];
  dropoff_locations: any[];
  cargo_items: any[];
  pod_requirements: string;
  delivery_order_preference: string;
  special_requirements: any;
}

export function RetailDeliveryTemplates() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<DeliveryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DeliveryTemplate | null>(null);

  const [formData, setFormData] = useState({
    template_name: '',
    pod_requirements: 'Photo',
    delivery_order_preference: 'Sequential',
  });

  useEffect(() => {
    fetchTemplates();
  }, [profile]);

  const fetchTemplates = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('retail_delivery_templates')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('retail_delivery_templates')
          .update({
            template_name: formData.template_name,
            pod_requirements: formData.pod_requirements,
            delivery_order_preference: formData.delivery_order_preference,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('retail_delivery_templates')
          .insert({
            profile_id: profile.id,
            template_name: formData.template_name,
            pod_requirements: formData.pod_requirements,
            delivery_order_preference: formData.delivery_order_preference,
          });

        if (error) throw error;
      }

      await fetchTemplates();
      setShowModal(false);
      setEditingTemplate(null);
      setFormData({
        template_name: '',
        pod_requirements: 'Photo',
        delivery_order_preference: 'Sequential',
      });
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  const handleEdit = (template: DeliveryTemplate) => {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      pod_requirements: template.pod_requirements,
      delivery_order_preference: template.delivery_order_preference,
    });
    setShowModal(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('retail_delivery_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">Loading templates...</div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Delivery Templates</h2>
              <p className="text-sm text-gray-600">Save common delivery configurations</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingTemplate(null);
              setFormData({
                template_name: '',
                pod_requirements: 'Photo',
                delivery_order_preference: 'Sequential',
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No delivery templates yet</p>
            <p className="text-sm text-gray-500">
              Create templates for frequently used delivery configurations
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">{template.template_name}</h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      <div className="text-sm">
                        <span className="text-gray-600">POD:</span>{' '}
                        <span className="text-gray-900 font-medium">{template.pod_requirements}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Order:</span>{' '}
                        <span className="text-gray-900 font-medium">{template.delivery_order_preference}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-xs text-purple-700">
            <strong>Note:</strong> Templates are optional shortcuts that can be applied when creating new delivery jobs. They do not automatically modify job creation behavior.
          </p>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={formData.template_name}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Daily Store Deliveries"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proof of Delivery Requirement
                </label>
                <select
                  value={formData.pod_requirements}
                  onChange={(e) => setFormData({ ...formData, pod_requirements: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="Photo">Photo</option>
                  <option value="Signature">Signature</option>
                  <option value="Both">Both</option>
                  <option value="None">None</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Order Preference
                </label>
                <select
                  value={formData.delivery_order_preference}
                  onChange={(e) => setFormData({ ...formData, delivery_order_preference: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="Sequential">Sequential (Recommended)</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  Additional template features (pickup/dropoff locations, cargo items, special requirements) can be added in future updates.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleSave}
                disabled={!formData.template_name}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Check className="w-4 h-4" />
                {editingTemplate ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTemplate(null);
                }}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
