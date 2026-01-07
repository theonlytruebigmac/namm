"use client";

import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Settings2,
  X,
  GripVertical,
  RotateCcw,
  LayoutGrid,
} from "lucide-react";
import { WidgetConfig } from "@/lib/dashboard-widgets";

interface SortableWidgetItemProps {
  widget: WidgetConfig;
  onToggle: (id: string) => void;
}

function SortableWidgetItem({ widget, onToggle }: SortableWidgetItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 rounded-lg border ${
        widget.enabled
          ? "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
          : "border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))] opacity-60"
      } ${isDragging ? "opacity-50 shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing focus:outline-none"
        >
          <GripVertical className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        </button>
        <div>
          <div className="font-medium text-sm text-[hsl(var(--foreground))]">
            {widget.title}
          </div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            {widget.description}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {widget.size}
        </Badge>
        <Switch
          checked={widget.enabled}
          onCheckedChange={() => onToggle(widget.id)}
        />
      </div>
    </div>
  );
}

interface WidgetCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WidgetCustomizer({ open, onOpenChange }: WidgetCustomizerProps) {
  const { widgets, toggle, reorder, reset } = useDashboardWidgets();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      reorder(oldIndex, newIndex);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[hsl(var(--card))] shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Customize Dashboard</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Drag to reorder widgets. Toggle to show or hide them on your dashboard.
          </p>

          {/* Sortable Widget List */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={widgets.map((w) => w.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {widgets.map((widget) => (
                  <SortableWidgetItem
                    key={widget.id}
                    widget={widget}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Reset Button */}
          <div className="pt-4 border-t border-[hsl(var(--border))]">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                reset();
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Button to open the widget customizer
 */
export function CustomizeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Settings2 className="h-4 w-4 mr-2" />
      Customize
    </Button>
  );
}
