'use client';

/**
 * Plugin Management Settings
 *
 * UI for managing installed plugins
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Package,
  Play,
  Square,
  Settings2,
  ChevronRight,
} from 'lucide-react';
import { usePlugins } from '@/hooks/usePlugins';
import type { RegisteredPlugin, PluginCategory } from '@/lib/plugins';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Category badge colors
 */
const categoryColors: Record<PluginCategory, string> = {
  visualization: 'bg-purple-500',
  messaging: 'bg-blue-500',
  automation: 'bg-orange-500',
  analysis: 'bg-green-500',
  export: 'bg-yellow-500',
  integration: 'bg-pink-500',
  other: 'bg-gray-500',
};

/**
 * State badge component
 */
function StateBadge({ state }: { state: RegisteredPlugin['state'] }) {
  switch (state) {
    case 'active':
      return (
        <Badge className="bg-green-500 text-white">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    case 'loaded':
      return (
        <Badge variant="secondary">
          <Package className="w-3 h-3 mr-1" />
          Loaded
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    case 'disabled':
      return (
        <Badge variant="outline">
          <Square className="w-3 h-3 mr-1" />
          Disabled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {state}
        </Badge>
      );
  }
}

/**
 * Plugin settings dialog
 */
function PluginSettingsDialog({ plugin }: { plugin: RegisteredPlugin }) {
  const { settingsSchema } = plugin.plugin;

  if (!settingsSchema || settingsSchema.fields.length === 0) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plugin.plugin.metadata.name} Settings</DialogTitle>
          <DialogDescription>
            Configure plugin-specific settings
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {settingsSchema.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              {field.type === 'string' && (
                <Input
                  id={field.key}
                  type="text"
                  defaultValue={String(field.defaultValue ?? '')}
                  placeholder={field.description}
                />
              )}
              {field.type === 'number' && (
                <Input
                  id={field.key}
                  type="number"
                  defaultValue={Number(field.defaultValue ?? 0)}
                  min={field.validation?.min}
                  max={field.validation?.max}
                />
              )}
              {field.type === 'boolean' && (
                <Switch defaultChecked={Boolean(field.defaultValue)} />
              )}
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Single plugin card
 */
function PluginCard({
  plugin,
  onActivate,
  onDeactivate
}: {
  plugin: RegisteredPlugin;
  onActivate: (id: string) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { metadata } = plugin.plugin;
  const isActive = plugin.state === 'active';

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      if (isActive) {
        await onDeactivate(metadata.id);
      } else {
        await onActivate(metadata.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              {metadata.name}
              <span className="text-xs text-muted-foreground font-normal">
                v{metadata.version}
              </span>
            </CardTitle>
            <CardDescription className="text-sm">
              {metadata.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <StateBadge state={plugin.state} />
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Switch
                checked={isActive}
                onCheckedChange={handleToggle}
                disabled={plugin.state === 'error'}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {metadata.category && (
              <Badge className={categoryColors[metadata.category]}>
                {metadata.category}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              by {metadata.author}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <PluginSettingsDialog plugin={plugin} />
            {metadata.homepage && (
              <Button variant="ghost" size="sm" asChild>
                <a href={metadata.homepage} target="_blank" rel="noopener noreferrer">
                  <ChevronRight className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {plugin.error && (
          <div className="mt-3 p-2 bg-destructive/10 text-destructive text-xs rounded">
            {plugin.error.message}
          </div>
        )}

        {plugin.loadedAt && (
          <div className="mt-2 text-xs text-muted-foreground">
            Loaded: {plugin.loadedAt.toLocaleString()}
            {plugin.activatedAt && (
              <> • Activated: {plugin.activatedAt.toLocaleString()}</>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Plugin management settings component
 */
export function PluginSettings() {
  const { plugins, isLoading, error, activatePlugin, deactivatePlugin } = usePlugins();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading plugins...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        Failed to load plugins: {error.message}
      </div>
    );
  }

  const activeCount = plugins.filter(p => p.state === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Plugins</h3>
          <p className="text-sm text-muted-foreground">
            {plugins.length} plugins installed • {activeCount} active
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Play className="w-4 h-4 mr-2" />
          Install Plugin
        </Button>
      </div>

      {plugins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No plugins installed yet.
              <br />
              Plugins extend NAMM with additional features.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.plugin.metadata.id}
              plugin={plugin}
              onActivate={activatePlugin}
              onDeactivate={deactivatePlugin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PluginSettings;
