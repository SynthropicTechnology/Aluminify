"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "@/app/shared/core/client";

/**
 * Student Organization - represents an organization where the student is enrolled
 */
export interface StudentOrganization {
  id: string;
  nome: string;
  slug: string;
  logoUrl: string | null;
  courseCount: number;
}

/**
 * Context type for student organizations
 */
export interface StudentOrganizationsContextType {
  /** List of all organizations where the student is enrolled */
  organizations: StudentOrganization[];
  /** Currently selected organization for filtering (null = all organizations) */
  activeOrganization: StudentOrganization | null;
  /** Set the active organization for filtering */
  setActiveOrganization: (org: StudentOrganization | null) => void;
  /** Whether the student is enrolled in multiple organizations */
  isMultiOrg: boolean;
  /** Whether organizations are being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refresh organizations from server */
  refreshOrganizations: () => Promise<void>;
}

const StudentOrganizationsContext =
  createContext<StudentOrganizationsContextType>({
    organizations: [],
    activeOrganization: null,
    setActiveOrganization: () => { },
    isMultiOrg: false,
    loading: false,
    error: null,
    refreshOrganizations: async () => { },
  });

interface StudentOrganizationsProviderProps {
  children: React.ReactNode;
  /** User info - only loads organizations if user is a student (role: "aluno") */
  user?: {
    id?: string;
    role?: string;
  } | null;
  /** Callback when active organization changes - useful for branding updates */
  onActiveOrganizationChange?: (org: StudentOrganization | null) => void;
}

const STORAGE_KEY = "student-active-organization";

export function StudentOrganizationsProvider({
  children,
  user,
  onActiveOrganizationChange,
}: StudentOrganizationsProviderProps) {
  const [organizations, setOrganizations] = useState<StudentOrganization[]>([]);
  const [activeOrganization, setActiveOrganizationState] =
    useState<StudentOrganization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const isMultiOrg = organizations.length > 1;

  // Load active organization from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && !initialized) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Will be validated against organizations list after they load
          setActiveOrganizationState(parsed);
        }
      } catch {
        // Ignore localStorage errors
      }
      setInitialized(true);
    }
  }, [initialized]);

  // Validate active organization against loaded organizations
  useEffect(() => {
    if (organizations.length > 0 && activeOrganization) {
      const isValid = organizations.some(
        (org) => org.id === activeOrganization.id
      );
      if (!isValid) {
        // Active organization is no longer valid - clear it
        setActiveOrganizationState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [organizations, activeOrganization]);

  const setActiveOrganization = useCallback(
    (org: StudentOrganization | null) => {
      setActiveOrganizationState(org);

      // Persist to localStorage
      if (typeof window !== "undefined") {
        if (org) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(org));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // Notify parent about the change
      onActiveOrganizationChange?.(org);
    },
    [onActiveOrganizationChange]
  );

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // During logout, session may be null - return gracefully
      if (!session?.access_token) {
        setOrganizations([]);
        return;
      }

      const response = await fetch("/api/usuario/alunos/organizations", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          // Not a student - this is expected for non-student users
          setOrganizations([]);
          return;
        }
        const contentType = response.headers.get("content-type") ?? "";
        let errorDetails = "";
        try {
          if (contentType.includes("application/json")) {
            const body = (await response.json()) as { error?: string };
            errorDetails = body?.error ? ` - ${body.error}` : "";
          } else {
            const text = await response.text();
            errorDetails = text ? ` - ${text}` : "";
          }
        } catch {
          // ignore parse errors
        }

        throw new Error(
          `Failed to fetch organizations (${response.status}): ${response.statusText}${errorDetails}`,
        );
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (err) {
      console.error("Failed to fetch student organizations:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load organizations"
      );
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, []); // dependencies optimized

  // Fetch organizations when user changes (only for students)
  useEffect(() => {
    if (user?.role === "aluno" && user?.id) {
      // Only fetch if not already loading to allow distinct calls
      // But wait, fetchOrganizations sets loading=true.
      // The issue might be user object reference changing often.
      // We rely on user.id and user.role primitive checks in dependency array.
      fetchOrganizations();
    } else {
      // Not a student - clear organizations
      setOrganizations([]);
      setActiveOrganizationState(null);
    }
  }, [user?.id, user?.role, fetchOrganizations]);

  const contextValue = useMemo(
    () => ({
      organizations,
      activeOrganization,
      setActiveOrganization,
      isMultiOrg,
      loading,
      error,
      refreshOrganizations: fetchOrganizations,
    }),
    [
      organizations,
      activeOrganization,
      setActiveOrganization,
      isMultiOrg,
      loading,
      error,
      fetchOrganizations,
    ]
  );

  return (
    <StudentOrganizationsContext.Provider value={contextValue}>
      {children}
    </StudentOrganizationsContext.Provider>
  );
}

/**
 * Hook to access student organizations context
 */
export function useStudentOrganizations() {
  const context = useContext(StudentOrganizationsContext);
  if (!context) {
    throw new Error(
      "useStudentOrganizations must be used within StudentOrganizationsProvider"
    );
  }
  return context;
}

/**
 * Hook to check if the current student is multi-org
 * Returns false if not a student or only enrolled in one org
 */
export function useIsMultiOrgStudent() {
  const { isMultiOrg, loading } = useStudentOrganizations();
  return { isMultiOrg, loading };
}
