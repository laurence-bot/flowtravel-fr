import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ops/messages")({
  beforeLoad: () => {
    throw redirect({ to: "/admin-messages" });
  },
});
