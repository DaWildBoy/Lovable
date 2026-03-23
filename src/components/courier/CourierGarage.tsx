import { useState } from 'react';
import { X, Truck, Plus, Check, ChevronDown, ToggleLeft, ToggleRight } from 'lucide-react';

interface CourierGarageProps {
  open: boolean;
  onClose: () => void;
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  plate: string;
  vehicleClass: string;
  isActive: boolean;
}

const VEHICLE_CLASSES = ['Motorbike', 'Panel Van', 'Pickup', '3-Ton', 'Hiab'];

const MOCK_VEHICLES: Vehicle[] = [
  {
    id: '1',
    make: 'Nissan',
    model: 'Frontier',
    plate: 'TDF 1234',
    vehicleClass: 'Pickup',
    isActive: true,
  },
  {
    id: '2',
    make: 'Toyota',
    model: 'HiAce',
    plate: 'PBM 5678',
    vehicleClass: 'Panel Van',
    isActive: false,
  },
];

export function CourierGarage({ open, onClose }: CourierGarageProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ make: '', model: '', plate: '', vehicleClass: '' });
  const [classDropdown, setClassDropdown] = useState(false);

  if (!open) return null;

  const toggleActive = (id: string) => {
    setVehicles((prev) =>
      prev.map((v) => ({
        ...v,
        isActive: v.id === id ? !v.isActive : false,
      }))
    );
  };

  const handleAdd = () => {
    if (!form.make || !form.model || !form.plate || !form.vehicleClass) return;
    const newVehicle: Vehicle = {
      id: Date.now().toString(),
      ...form,
      isActive: false,
    };
    setVehicles((prev) => [...prev, newVehicle]);
    setForm({ make: '', model: '', plate: '', vehicleClass: '' });
    setShowAddForm(false);
  };

  const activeVehicle = vehicles.find((v) => v.isActive);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
      <header className="flex-shrink-0 bg-moveme-blue-900 text-white">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <Truck className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Vehicle Fleet</h1>
              <p className="text-xs text-white/50 mt-0.5">
                {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} registered
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-lg mx-auto p-4 space-y-3">
          {activeVehicle && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-emerald-800">Active Vehicle for Today's Shift</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {activeVehicle.make} {activeVehicle.model} - {activeVehicle.plate}
                </p>
              </div>
            </div>
          )}

          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                vehicle.isActive ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-gray-100'
              }`}
            >
              <div className="p-4 flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    vehicle.isActive ? 'bg-emerald-50' : 'bg-slate-50'
                  }`}
                >
                  <Truck
                    className={`w-5 h-5 ${vehicle.isActive ? 'text-emerald-600' : 'text-slate-400'}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {vehicle.make} {vehicle.model}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 font-mono">{vehicle.plate}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="text-xs text-gray-400">{vehicle.vehicleClass}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(vehicle.id)}
                  className="flex-shrink-0"
                  aria-label={vehicle.isActive ? 'Deactivate vehicle' : 'Activate vehicle'}
                >
                  {vehicle.isActive ? (
                    <ToggleRight className="w-8 h-8 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-300" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center gap-2 hover:border-moveme-blue-300 hover:bg-moveme-blue-50/30 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Plus className="w-5 h-5 text-slate-500" />
              </div>
              <span className="text-sm font-semibold text-gray-600">Add New Vehicle</span>
              <span className="text-[11px] text-gray-400">Register another vehicle to your fleet</span>
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">New Vehicle Details</h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Make</label>
                  <input
                    type="text"
                    value={form.make}
                    onChange={(e) => setForm({ ...form, make: e.target.value })}
                    placeholder="e.g. Toyota"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Model</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="e.g. HiAce"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">License Plate</label>
                  <input
                    type="text"
                    value={form.plate}
                    onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })}
                    placeholder="e.g. TDF 1234"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm text-gray-900 font-mono placeholder:text-gray-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Vehicle Class</label>
                  <button
                    onClick={() => setClassDropdown(!classDropdown)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent transition-all"
                  >
                    <span className={form.vehicleClass ? 'text-gray-900' : 'text-gray-400'}>
                      {form.vehicleClass || 'Select class'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${classDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {classDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-elevated z-10 py-1 animate-fade-in">
                      {VEHICLE_CLASSES.map((cls) => (
                        <button
                          key={cls}
                          onClick={() => {
                            setForm({ ...form, vehicleClass: cls });
                            setClassDropdown(false);
                          }}
                          className="w-full px-3.5 py-2.5 text-sm text-left text-gray-700 hover:bg-slate-50 transition-colors flex items-center justify-between"
                        >
                          {cls}
                          {form.vehicleClass === cls && <Check className="w-4 h-4 text-moveme-blue-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleAdd}
                    disabled={!form.make || !form.model || !form.plate || !form.vehicleClass}
                    className="flex-1 py-2.5 bg-moveme-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-moveme-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    Add Vehicle
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setForm({ make: '', model: '', plate: '', vehicleClass: '' });
                    }}
                    className="px-5 py-2.5 bg-slate-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
