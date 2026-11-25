import { useEffect, useState } from 'react';
import { getCachedCoverBlob } from '../utils/coverBlobCache';

/** Gera uma URL temporária somente enquanto a imagem está em uso. */
export function useCoverUrl(mediaId?: string, coverId?: string) {
  const [image, setImage] = useState<{ key: string; url: string }>();
  const key = mediaId && coverId ? `${mediaId}:${coverId}` : undefined;

  useEffect(() => {
    if (!mediaId || !coverId || !key) return;
    let active = true;
    let objectUrl: string | undefined;
    void getCachedCoverBlob(mediaId, coverId)
      .then((blob) => {
        if (blob && active) {
          objectUrl = URL.createObjectURL(blob);
          setImage({ key, url: objectUrl });
        }
      })
      .catch(() => { if (active) setImage(undefined); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, coverId, key]);

  return image && image.key === key ? image.url : undefined;
}
