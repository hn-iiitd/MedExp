import { useState, useRef } from 'react';
import { api } from '../api';

export default function UploadBill({ onSuccess, onError }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    const ext = file.name.toLowerCase().split('.').pop();
    if (!['pdf', 'xlsx', 'xls', 'csv'].includes(ext)) {
      onError('Only PDF, XLSX, XLS, and CSV files are supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onError('File size must be less than 10MB.');
      return;
    }

    setUploading(true);
    try {
      const result = await api.uploadBill(file);
      onSuccess(result);
    } catch (err) {
      onError(err.message || 'Failed to upload bill');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-gray-900 mb-3">Upload a Bill</h3>
      <p className="text-sm text-gray-500 mb-4">
        Upload a PDF or Excel bill to extract medicine data automatically.
      </p>

      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${dragActive ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-gray-400'}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
            <p className="text-sm text-gray-600">Processing bill...</p>
          </div>
        ) : (
          <>
            <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600">
              <span className="text-primary-600 font-medium">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, XLSX, XLS, CSV (max 10MB)</p>
          </>
        )}
      </div>
    </div>
  );
}
