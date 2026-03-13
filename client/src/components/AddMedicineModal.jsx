import { useState } from 'react';

export default function AddMedicineModal({ onAdd, onClose }) {
  const [form, setForm] = useState({
    medicine_name: '',
    expiry_date: '',
    batch_no: '',
    bill_date: '',
    distributor_name: '',
    mrp: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.medicine_name.trim()) return;
    onAdd(form);
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Add Medicine</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medicine Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.medicine_name}
              onChange={handleChange('medicine_name')}
              className="input-field"
              placeholder="e.g. Paracetamol 500mg"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={handleChange('expiry_date')}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch No</label>
              <input
                type="text"
                value={form.batch_no}
                onChange={handleChange('batch_no')}
                className="input-field"
                placeholder="e.g. BT-2024-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill Date</label>
              <input
                type="date"
                value={form.bill_date}
                onChange={handleChange('bill_date')}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distributor</label>
              <input
                type="text"
                value={form.distributor_name}
                onChange={handleChange('distributor_name')}
                className="input-field"
                placeholder="e.g. ABC Pharma"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MRP (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.mrp}
              onChange={handleChange('mrp')}
              className="input-field"
              placeholder="e.g. 125.50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              Add Medicine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
