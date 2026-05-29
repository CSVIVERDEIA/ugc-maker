import { useLocation, useSearch } from "wouter";

/** Drop-in replacement for next/navigation's useRouter (wouter-backed). */
export function useRouter() {
  const [, navigate] = useLocation();
  return {
    push: (href) => navigate(href),
    replace: (href) => navigate(href, { replace: true }),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => {},
    prefetch: () => {},
  };
}

export function usePathname() {
  const [location] = useLocation();
  return location;
}

export function useSearchParams() {
  const search = useSearch();
  return new URLSearchParams(search || "");
}

export function useParams() {
  return {};
}
