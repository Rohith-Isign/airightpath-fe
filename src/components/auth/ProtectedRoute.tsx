import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRbac } from '@/hooks/useRbac';
import { ROUTES } from '@/config/routes';
import { clearPostLoginRedirect, rememberPostLoginRedirect } from '@/utils/post-login-redirect.utils';
import { AuthLoadingScreen } from './AuthLoadingScreen';
import type { RoleName } from '@/config/roles';
import type { PermissionName } from '@/config/permissions';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: RoleName[];
  requiredPermissions?: PermissionName[];
}

export function ProtectedRoute({ children, allowedRoles, requiredPermissions }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasAnyRole, hasAnyPermission } = useRbac();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  // Signed out: remember where they were going, so signing in (or registering first) brings them back here.
  // Signed in and on a protected page: the remembered page has been reached (or replaced), so it is forgotten.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) rememberPostLoginRedirect(from);
    else clearPostLoginRedirect();
  }, [isAuthenticated, isLoading, from]);

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    // Also handed to the login page directly, for a sign-in in this same visit.
    return <Navigate to={ROUTES.PUBLIC.LOGIN} state={{ from }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {
    return <Navigate to={ROUTES.ERRORS.FORBIDDEN} replace />;
  }

  if (requiredPermissions && requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
    return <Navigate to={ROUTES.ERRORS.FORBIDDEN} replace />;
  }

  return <>{children}</>;
}
