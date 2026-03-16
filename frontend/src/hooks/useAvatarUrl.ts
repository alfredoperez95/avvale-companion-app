'use client';

import { useState, useEffect } from 'react';
import { getToken } from '@/lib/api';

const getBaseUrl = () =>
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '')
    : process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Fetches the authenticated user's avatar and returns an object URL (requires Authorization).
 * Returns null while loading or when avatarPath is empty. Revokes the object URL on unmount.
 */
export function useAvatarUrl(avatarPath: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarPath || typeof window === 'undefined') {
      setUrl(null);
      return;
    }
    const token = getToken();
    if (!token) {
      setUrl(null);
      return;
    }
    let revoked = false;
    fetch(`${getBaseUrl()}/api/auth/me/avatar`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (revoked || !blob) return;
        setUrl(URL.createObjectURL(blob));
      })
      .catch(() => setUrl(null));

    return () => {
      revoked = true;
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [avatarPath]);

  return url;
}
