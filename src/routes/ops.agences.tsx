import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ops/agences")({
  beforeLoad: () => {
    throw redirect({ to: "/admin-agences" });
  },
});
