"use client";

import * as React from 'react';
import { getCachedPatientImageUrls, resolvePatientImageUrls } from '@/lib/api';

export function useSignedPatientImages(
  imageUrls: string[] | null | undefined,
  expiresInSeconds = 3600
) {
  const urlsKey = (imageUrls || []).filter(Boolean).join('\n');

  const [signedUrlMap, setSignedUrlMap] = React.useState<Record<string, string>>(() => {
    if (!urlsKey) return {};
    return getCachedPatientImageUrls(urlsKey.split('\n')).cachedMap;
  });
  const [isResolving, setIsResolving] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    if (!urlsKey) {
      setSignedUrlMap({});
      setIsResolving(false);
      return;
    }

    const items = urlsKey.split('\n');
    const { cachedMap, hasMissing } = getCachedPatientImageUrls(items);
    setSignedUrlMap(cachedMap);

    if (!hasMissing) {
      setIsResolving(false);
      return;
    }

    setIsResolving(true);

    resolvePatientImageUrls(items, expiresInSeconds)
      .then((resolved) => {
        if (isMounted) {
          setSignedUrlMap(resolved);
        }
      })
      .catch((error) => {
        console.error('Failed to resolve signed patient image URLs:', error);
      })
      .finally(() => {
        if (isMounted) {
          setIsResolving(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [urlsKey, expiresInSeconds]);

  return { signedUrlMap, isResolving };
}
