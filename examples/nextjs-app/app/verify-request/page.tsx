'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type VerificationState = 'loading' | 'success' | 'error' | 'missing-token';

interface VerificationResult {
  success: boolean;
  message?: string;
  requestId?: string;
  error?: string;
}

function VerificationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<VerificationState>('loading');
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    if (!token) {
      setState('missing-token');
      return;
    }

    const verifyRequest = async () => {
      try {
        const response = await fetch('/api/compliance/public/requests/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        setResult(data);
        setState(data.success ? 'success' : 'error');
      } catch {
        setState('error');
        setResult({ success: false, error: 'Failed to verify request. Please try again.' });
      }
    };

    verifyRequest();
  }, [token]);

  return (
    <>
      {state === 'loading' && (
        <div style={styles.content}>
          <div style={styles.spinner} />
          <p>Verifying your request...</p>
        </div>
      )}

      {state === 'missing-token' && (
        <div style={styles.content}>
          <div style={styles.icon}>&#10060;</div>
          <h2 style={styles.subtitle}>Invalid Link</h2>
          <p>This verification link is invalid. Please check your email and try clicking the link again.</p>
        </div>
      )}

      {state === 'success' && result && (
        <div style={styles.content}>
          <div style={styles.iconSuccess}>&#10003;</div>
          <h2 style={styles.subtitle}>Verified!</h2>
          <p>{result.message}</p>
          {result.requestId && (
            <p style={styles.requestId}>
              Request ID: <code>{result.requestId}</code>
            </p>
          )}
          <p style={styles.note}>
            You can close this page. We&apos;ll notify you by email when your request has been processed.
          </p>
        </div>
      )}

      {state === 'error' && result && (
        <div style={styles.content}>
          <div style={styles.icon}>&#10060;</div>
          <h2 style={styles.subtitle}>Verification Failed</h2>
          <p>{result.error}</p>
          <p style={styles.note}>
            If you continue to have issues, please contact our support team.
          </p>
        </div>
      )}
    </>
  );
}

function LoadingFallback() {
  return (
    <div style={styles.content}>
      <div style={styles.spinner} />
      <p>Loading...</p>
    </div>
  );
}

export default function VerifyRequestPage() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Request Verification</h1>
        <Suspense fallback={<LoadingFallback />}>
          <VerificationContent />
        </Suspense>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 24px 0',
    fontSize: '24px',
    fontWeight: 600,
    color: '#333',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  subtitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 500,
    color: '#333',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e0e0e0',
    borderTop: '3px solid #0070f3',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  icon: {
    fontSize: '48px',
    color: '#dc3545',
  },
  iconSuccess: {
    fontSize: '48px',
    color: '#28a745',
    backgroundColor: '#d4edda',
    borderRadius: '50%',
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestId: {
    backgroundColor: '#f5f5f5',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '14px',
  },
  note: {
    color: '#666',
    fontSize: '14px',
    marginTop: '8px',
  },
};
