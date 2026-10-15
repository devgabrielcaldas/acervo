import { useEffect, useState } from 'react';
import { getCoverBlob } from '../services/coverRepository';

/** Gera uma URL temporária somente enquanto a imagem está em uso. */
export function useCoverUrl(mediaId?: string, coverId?: string) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!mediaId || !coverId) return;
    let mounted = true;
    let objectUrl: string | undefined;
    void getCoverBlob(mediaId)
      .then((blob) => {
        if (blob && mounted) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {
        if (mounted) setUrl(undefined);
      });
    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, coverId]);

  return coverId ? url : undefined;
}
