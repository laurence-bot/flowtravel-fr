import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ops/errors")({
  beforeLoad: () => {
    throw redirect({ to: "/admin-errors" });
  },
});
