"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Globe, Image as ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

interface LinkPreviewProps {
  url: string;
  compact?: boolean;
}

// Simple regex to extract URLs from text
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
  const matches = text.match(urlRegex);
  return matches || [];
}

// Check if a string contains any URLs
export function hasUrls(text: string): boolean {
  return extractUrls(text).length > 0;
}

// Parse basic metadata from URL without API call (for common sites)
function getBasicMetadata(url: string): Partial<LinkMetadata> {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    // Known site patterns
    const patterns: Record<string, { siteName: string; icon?: string }> = {
      "github.com": { siteName: "GitHub" },
      "youtube.com": { siteName: "YouTube" },
      "youtu.be": { siteName: "YouTube" },
      "twitter.com": { siteName: "Twitter" },
      "x.com": { siteName: "X (Twitter)" },
      "reddit.com": { siteName: "Reddit" },
      "stackoverflow.com": { siteName: "Stack Overflow" },
      "meshtastic.org": { siteName: "Meshtastic" },
      "discord.com": { siteName: "Discord" },
      "discord.gg": { siteName: "Discord" },
    };

    const known = patterns[hostname];

    return {
      url,
      siteName: known?.siteName || hostname,
      favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
    };
  } catch {
    return { url };
  }
}

export function LinkPreview({ url, compact = false }: LinkPreviewProps) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Get basic metadata immediately
    const basic = getBasicMetadata(url);
    setMetadata({ url, ...basic } as LinkMetadata);
    setLoading(false);

    // Could add API call for full metadata here if we have a backend endpoint
    // For now, just use basic metadata
  }, [url]);

  if (error) {
    return null;
  }

  if (loading) {
    return (
      <div className="mt-2 rounded-lg border border-[hsl(var(--border))] overflow-hidden">
        <div className="p-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    );
  }

  if (!metadata) {
    return null;
  }

  const handleClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 mt-1 px-2 py-1 text-xs rounded-md bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors"
      >
        {metadata.favicon && !imageError ? (
          <img
            src={metadata.favicon}
            alt=""
            className="w-3.5 h-3.5"
            onError={() => setImageError(true)}
          />
        ) : (
          <Globe className="w-3.5 h-3.5" />
        )}
        <span className="text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">
          {metadata.siteName || new URL(url).hostname}
        </span>
        <ExternalLink className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="w-full mt-2 text-left rounded-lg border border-[hsl(var(--border))] overflow-hidden hover:border-[hsl(var(--primary))] transition-colors group"
    >
      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          {metadata.favicon && !imageError ? (
            <img
              src={metadata.favicon}
              alt=""
              className="w-4 h-4"
              onError={() => setImageError(true)}
            />
          ) : (
            <Globe className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          )}
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {metadata.siteName || new URL(url).hostname}
          </span>
        </div>

        {metadata.title && (
          <h4 className="text-sm font-medium text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] line-clamp-1">
            {metadata.title}
          </h4>
        )}

        {metadata.description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
            {metadata.description}
          </p>
        )}

        <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
          <ExternalLink className="w-3 h-3" />
          <span className="truncate">{url}</span>
        </div>
      </div>

      {metadata.image && !imageError && (
        <div className="border-t border-[hsl(var(--border))]">
          <img
            src={metadata.image}
            alt=""
            className="w-full h-32 object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      )}
    </button>
  );
}

// Component that renders message text with clickable links and previews
export function MessageTextWithLinks({
  text,
  showPreviews = true,
  isMyMessage = false
}: {
  text: string;
  showPreviews?: boolean;
  isMyMessage?: boolean;
}) {
  const urls = extractUrls(text);

  // Replace URLs with clickable links
  const renderText = () => {
    if (urls.length === 0) {
      return <span>{text}</span>;
    }

    let lastIndex = 0;
    const parts: React.ReactNode[] = [];

    urls.forEach((url, i) => {
      const index = text.indexOf(url, lastIndex);

      // Add text before URL
      if (index > lastIndex) {
        parts.push(<span key={`text-${i}`}>{text.slice(lastIndex, index)}</span>);
      }

      // Add clickable URL
      parts.push(
        <a
          key={`link-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline hover:no-underline ${
            isMyMessage ? "text-white/90 hover:text-white" : "text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]/80"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {url.length > 50 ? url.slice(0, 50) + "..." : url}
        </a>
      );

      lastIndex = index + url.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
    }

    return <>{parts}</>;
  };

  return (
    <div>
      <p className="text-sm break-words">{renderText()}</p>
      {showPreviews && urls.length > 0 && (
        <div className="space-y-2">
          {urls.slice(0, 2).map((url, i) => (
            <LinkPreview key={i} url={url} compact={urls.length > 1} />
          ))}
          {urls.length > 2 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              +{urls.length - 2} more link{urls.length - 2 > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
