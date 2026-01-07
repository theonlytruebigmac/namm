"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useMessageTemplates,
  type MessageTemplate,
} from "@/hooks/useMessageTemplates";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Hash,
  ChevronDown,
  Zap,
} from "lucide-react";

interface TemplatePickerProps {
  onSelectTemplate: (content: string) => void;
  onSaveAsTemplate?: (content: string) => void;
  currentMessage?: string;
}

export function TemplatePicker({
  onSelectTemplate,
  onSaveAsTemplate,
  currentMessage,
}: TemplatePickerProps) {
  const { templates, recentTemplates, createTemplate, useTemplate } =
    useMessageTemplates();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newShortcut, setNewShortcut] = useState("");

  const handleSelect = (id: string) => {
    const content = useTemplate(id);
    if (content) {
      onSelectTemplate(content);
    }
  };

  const handleCreate = () => {
    if (newName && newContent) {
      createTemplate(newName, newContent, newShortcut || undefined);
      setNewName("");
      setNewContent("");
      setNewShortcut("");
      setShowCreate(false);
    }
  };

  const handleSaveCurrent = () => {
    if (currentMessage && onSaveAsTemplate) {
      setNewContent(currentMessage);
      setShowCreate(true);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Message Templates">
          <FileText className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {recentTemplates.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
              Recent Templates
            </div>
            {recentTemplates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => handleSelect(template.id)}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">{template.name}</span>
                  {template.shortcut && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      /{template.shortcut}
                    </Badge>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {templates.length > 5 && (
          <>
            <Dialog>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <FileText className="h-4 w-4 mr-2" />
                  View All Templates ({templates.length})
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Message Templates</DialogTitle>
                  <DialogDescription>
                    Select a template to insert into your message
                  </DialogDescription>
                </DialogHeader>
                <TemplateListModal
                  templates={templates}
                  onSelect={(content) => {
                    onSelectTemplate(content);
                  }}
                />
              </DialogContent>
            </Dialog>
            <DropdownMenuSeparator />
          </>
        )}

        {currentMessage && currentMessage.length > 0 && (
          <DropdownMenuItem onClick={handleSaveCurrent}>
            <Plus className="h-4 w-4 mr-2" />
            Save Current as Template
          </DropdownMenuItem>
        )}

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Template
            </DropdownMenuItem>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Message Template</DialogTitle>
              <DialogDescription>
                Save a message template for quick access
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Standard Greeting"
                />
              </div>
              <div>
                <Label htmlFor="template-content">Message Content</Label>
                <Textarea
                  id="template-content"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Enter your template message..."
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="template-shortcut">
                  Shortcut (optional)
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">/</span>
                  <Input
                    id="template-shortcut"
                    value={newShortcut}
                    onChange={(e) => setNewShortcut(e.target.value.replace(/\s/g, ""))}
                    placeholder="e.g., hi"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Type /{newShortcut || "shortcut"} to quickly insert this template
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newName || !newContent}>
                Create Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DropdownMenuSeparator />

        <Dialog>
          <DialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Zap className="h-4 w-4 mr-2" />
              Manage Templates
            </DropdownMenuItem>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Templates</DialogTitle>
              <DialogDescription>
                Edit or delete your message templates
              </DialogDescription>
            </DialogHeader>
            <TemplateManager />
          </DialogContent>
        </Dialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TemplateListModalProps {
  templates: MessageTemplate[];
  onSelect: (content: string) => void;
}

function TemplateListModal({ templates, onSelect }: TemplateListModalProps) {
  return (
    <div className="max-h-[400px] overflow-y-auto space-y-2">
      {templates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template.content)}
          className="w-full text-left p-3 rounded-lg bg-muted hover:bg-accent transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">{template.name}</span>
            {template.shortcut && (
              <Badge variant="outline" className="text-xs">
                /{template.shortcut}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {template.content}
          </p>
        </button>
      ))}
    </div>
  );
}

function TemplateManager() {
  const { templates, updateTemplate, deleteTemplate } = useMessageTemplates();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editShortcut, setEditShortcut] = useState("");

  const startEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditContent(template.content);
    setEditShortcut(template.shortcut || "");
  };

  const saveEdit = () => {
    if (editingId && editName && editContent) {
      updateTemplate(editingId, {
        name: editName,
        content: editContent,
        shortcut: editShortcut || undefined,
      });
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditContent("");
    setEditShortcut("");
  };

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No templates yet</p>
        <p className="text-sm">Create your first template to get started</p>
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto space-y-3 py-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="p-4 rounded-lg border bg-card"
        >
          {editingId === template.id ? (
            <div className="space-y-3">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Template name"
              />
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
              />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">/</span>
                <Input
                  value={editShortcut}
                  onChange={(e) => setEditShortcut(e.target.value.replace(/\s/g, ""))}
                  placeholder="shortcut"
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{template.name}</h4>
                  {template.shortcut && (
                    <Badge variant="outline" className="text-xs">
                      /{template.shortcut}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    Used {template.usageCount}x
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEdit(template)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteTemplate(template.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {template.content}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Inline template suggestions that appear when typing /shortcut
 */
interface TemplateAutoCompleteProps {
  input: string;
  onSelect: (content: string) => void;
}

export function TemplateAutoComplete({
  input,
  onSelect,
}: TemplateAutoCompleteProps) {
  const { templates } = useMessageTemplates();

  // Check if input starts with /
  if (!input.startsWith("/") || input.length < 2) {
    return null;
  }

  const query = input.slice(1).toLowerCase();
  const matches = templates.filter(
    (t) => t.shortcut && t.shortcut.toLowerCase().startsWith(query)
  );

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 w-full mb-2 bg-popover border rounded-lg shadow-lg overflow-hidden">
      {matches.slice(0, 5).map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template.content)}
          className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between"
        >
          <span className="font-medium">{template.name}</span>
          <Badge variant="outline" className="text-xs">
            /{template.shortcut}
          </Badge>
        </button>
      ))}
    </div>
  );
}
