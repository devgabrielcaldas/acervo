import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { CollectionPage } from './pages/CollectionPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HistoryPage } from './pages/HistoryPage';
import { MediaDetailPage } from './pages/MediaDetailPage';
import { MediaFormPage } from './pages/MediaFormPage';
import { GoalsPage } from './pages/GoalsPage';
import { StoragePage } from './pages/StoragePage';
import { WishlistPage } from './pages/WishlistPage';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading" role="status">Abrindo seu Acervo…</div>;
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="colecao" element={<CollectionPage />} />
        <Route path="colecao/:id" element={<MediaDetailPage />} />
        <Route path="novo" element={<MediaFormPage />} />
        <Route path="editar/:id" element={<MediaFormPage />} />
        <Route path="desejos" element={<WishlistPage />} />
        <Route path="historico" element={<HistoryPage />} />
        <Route path="favoritos" element={<FavoritesPage />} />
        <Route path="metas" element={<GoalsPage />} />
        <Route path="configuracoes" element={<StoragePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
