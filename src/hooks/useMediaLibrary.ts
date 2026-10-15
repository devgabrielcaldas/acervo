import { useCallback, useEffect, useState } from 'react';
import { listMedia, updateMedia } from '../services/mediaRepository';
import type { DateOnly, MediaRecord, MediaStatus } from '../types/media';

export function getMediaError(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível acessar os dados locais.';
}

/** Lê uma coleção única: desejos e favoritos são apenas filtros sobre os registros. */
export function useMediaLibrary() {
  const [items, setItems] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string>();

  const refresh = useCallback(async () => {
    const records = await listMedia();
    setItems(records);
    setError('');
  }, []);

  useEffect(() => {
    let active = true;
    void listMedia()
      .then((records) => { if (active) { setItems(records); setError(''); } })
      .catch((reason: unknown) => { if (active) setError(getMediaError(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = useCallback(async (
    item: MediaRecord,
    changes: { status?: MediaStatus; completedOn?: DateOnly; favorite?: boolean },
  ): Promise<string | null> => {
    setBusyId(item.id);
    try {
      // updateMedia preserva ID, capa e createdAt. O status não cria outro item.
      await updateMedia(item.id, { ...item, ...changes });
      await refresh();
      return null;
    } catch (reason) {
      const message = getMediaError(reason);
      setError(message);
      return message;
    } finally {
      setBusyId(undefined);
    }
  }, [refresh]);

  const toggleFavorite = useCallback((item: MediaRecord) =>
    save(item, { favorite: !item.favorite }), [save]);

  const changeStatus = useCallback((item: MediaRecord, status: MediaStatus, completedOn?: DateOnly) =>
    save(item, { status, completedOn: status === 'completed' ? completedOn : undefined }), [save]);

  return { items, loading, error, busyId, toggleFavorite, changeStatus };
}
