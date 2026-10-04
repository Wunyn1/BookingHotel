import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function RoleRoute({ allowed, children }) {
  const { user, isAuthenticated } = useAuth(); const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (allowed && !allowed.includes(user.role)) return <Navigate to="/403" replace />;
  return children;
}
