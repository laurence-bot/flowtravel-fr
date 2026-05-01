import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias /ops/dashboard → page existante /admin-dashboard (gardée pour compat)
export const Route = createFileRoute("/ops/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/admin-dashboard" });
  },
});
