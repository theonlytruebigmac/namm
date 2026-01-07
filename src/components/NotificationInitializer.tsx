"use client";

import { useEffect } from "react";
import { initializeNotifications } from "@/lib/notifications";

export function NotificationInitializer() {
  useEffect(() => {
    initializeNotifications();
  }, []);

  return null;
}
