import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ops/demos")({
  beforeLoad: () => {
    throw redirect({ to: "/admin-demos" });
  },
});
