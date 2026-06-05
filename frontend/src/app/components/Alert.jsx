import { AlertCircleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AlertDestructive({ tittle, message, status }) {
  return (
    <Alert
      variant={`${status === "status" ? "destructive" : ""}`}
      className="max-w-md fixed top-5 right-5 "
    >
      <AlertCircleIcon />
      <AlertTitle>{tittle}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
