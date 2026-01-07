"use client";

import { Button } from "@/components/ui/button";
import { Send, MapPin, Radio, Download, Upload } from "lucide-react";

export function QuickActions() {
  return (
    <div className="fixed bottom-20 right-6 lg:bottom-6 z-30 flex flex-col gap-2">
      <Button
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg"
        title="Send Message"
      >
        <Send className="h-5 w-5" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-12 w-12 rounded-full shadow-lg bg-[hsl(var(--background))]"
        title="Locate Nodes"
      >
        <MapPin className="h-5 w-5" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-12 w-12 rounded-full shadow-lg bg-[hsl(var(--background))]"
        title="Scan Network"
      >
        <Radio className="h-5 w-5" />
      </Button>
    </div>
  );
}
