import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/Layout/AppLayout';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import ContentLibrary from '@/pages/ContentLibrary';
import CreateContent from '@/pages/CreateContent';
import MyContent from '@/pages/MyContent';
import Classes from '@/pages/Classes';
import ClassDetail from '@/pages/ClassDetail';
import Users from '@/pages/Users';
import Organizations from '@/pages/Organizations';
import Profile from '@/pages/Profile';
import ResetPassword from '@/pages/ResetPassword';
import Terms from '@/pages/Terms';
import { useAuthStore } from '@/store/authStore';

function AuthRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return <Landing />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthRedirect />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="content" element={<ContentLibrary />} />
        <Route path="content/create" element={<CreateContent />} />
        <Route path="my-content" element={<MyContent />} />
        <Route path="classes" element={<Classes />} />
        <Route path="classes/:id" element={<ClassDetail />} />
        <Route path="users" element={<Users />} />
        <Route path="organizations" element={<Organizations />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
