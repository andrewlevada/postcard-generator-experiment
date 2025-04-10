import React, { useState } from 'react';

interface AppProps {
  onSubmit: (header: string) => void;
}

export function App({ onSubmit }: AppProps) {
  const [header, setHeader] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await onSubmit(header);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          value={header}
          onChange={(e) => setHeader(e.target.value)}
          placeholder="Enter header text"
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '14px',
            border: '1px solid #e5e5e5',
            borderRadius: '4px',
          }}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={isLoading || !header}
        style={{
          width: '100%',
          padding: '8px 16px',
          backgroundColor: '#18A0FB',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading || !header ? 'not-allowed' : 'pointer',
          opacity: isLoading || !header ? 0.5 : 1,
        }}
      >
        {isLoading ? 'Processing...' : 'Make Postcard'}
      </button>
    </div>
  );
} 