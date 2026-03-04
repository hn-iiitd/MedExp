import { useState } from 'react';
import { api } from '../api';

export default function FetchEmails({ onSuccess, onError }) {
  const [fetching, setFetching] = useState(false);

  const handleFetch = async () => {
    setFetching(true);
    try {
      const result = await api.fetchFromEmails();
      if (result.reauth) {
        onError('Gmail access expired. Please sign out and sign in again.');
        return;
      }
      onSuccess(result);
    } catch (err) {
      if (err.data?.reauth) {
        onError('Gmail access expired. Please sign out and sign in again.');
      } else {
        onError(err.message || 'Failed to fetch emails');
      }
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-gray-900 mb-3">Fetch from Gmail</h3>
      <p className="text-sm text-gray-500 mb-4">
        Scan your Gmail for bill attachments (PDF/Excel) from the last 6 months.
      </p>

      <button
        onClick={handleFetch}
        disabled={fetching}
        className="w-full flex items-center justify-center gap-2 btn-primary py-3"
      >
        {fetching ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Scanning emails...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Fetch Bills from Gmail
          </>
        )}
      </button>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Already processed emails will be skipped automatically.
      </p>
    </div>
  );
}
