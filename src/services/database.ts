import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type {
  AnnualGoal,
  CoverRecord,
  MediaCategory,
  MediaRecord,
  MediaStatus,
} from '../types/media';

const DATABASE_NAME = 'acervo-local';
const DATABASE_VERSION = 1;

interface AcervoDatabase extends DBSchema {
  media: {
    key: string;
    value: MediaRecord;
    indexes: {
      'by-kind': MediaCategory;
      'by-status': MediaStatus;
      'by-kind-status': [MediaCategory, MediaStatus];
      'by-completed-on': string;
    };
  };
  covers: {
    key: string;
    value: CoverRecord;
    indexes: { 'by-media-id': string };
  };
  goals: {
    key: number;
    value: AnnualGoal;
  };
}

let databasePromise: Promise<IDBPDatabase<AcervoDatabase>> | undefined;

/** Abre uma única conexão reutilizável. Não apaga bancos em caso de falha. */
export function getDatabase(): Promise<IDBPDatabase<AcervoDatabase>> {
  if (!databasePromise) {
    databasePromise = openDB<AcervoDatabase>(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(db) {
        const media = db.createObjectStore('media', { keyPath: 'id' });
        media.createIndex('by-kind', 'kind');
        media.createIndex('by-status', 'status');
        media.createIndex('by-kind-status', ['kind', 'status']);
        media.createIndex('by-completed-on', 'completedOn');

        const covers = db.createObjectStore('covers', { keyPath: 'id' });
        covers.createIndex('by-media-id', 'mediaId', { unique: true });

        db.createObjectStore('goals', { keyPath: 'year' });
      },
      blocking() {
        // Libera a conexão antiga quando uma futura versão precisar atualizar o banco.
        void databasePromise?.then((database) => database.close());
        databasePromise = undefined;
      },
      terminated() {
        databasePromise = undefined;
      },
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}
