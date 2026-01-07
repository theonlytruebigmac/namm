"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export type HeatmapDataType =
  | "signal-strength"
  | "node-density"
  | "channel-utilization"
  | "battery-levels"
  | "activity";

interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number; // 0-1
}

interface HeatmapLayerProps {
  points: HeatmapPoint[];
  enabled?: boolean;
  radius?: number;
  blur?: number;
  maxIntensity?: number;
  gradient?: Record<number, string>;
  opacity?: number;
}

// Default gradients for different heatmap types
export const HEATMAP_GRADIENTS: Record<HeatmapDataType, Record<number, string>> = {
  "signal-strength": {
    0.0: "#2563eb",   // Blue (weak)
    0.3: "#22c55e",   // Green
    0.6: "#eab308",   // Yellow
    0.8: "#f97316",   // Orange
    1.0: "#ef4444",   // Red (strong)
  },
  "node-density": {
    0.0: "transparent",
    0.2: "#22d3ee",   // Cyan
    0.4: "#3b82f6",   // Blue
    0.6: "#8b5cf6",   // Violet
    0.8: "#d946ef",   // Fuchsia
    1.0: "#f43f5e",   // Rose
  },
  "channel-utilization": {
    0.0: "#22c55e",   // Green (low usage)
    0.3: "#84cc16",   // Lime
    0.5: "#eab308",   // Yellow
    0.7: "#f97316",   // Orange
    1.0: "#ef4444",   // Red (high usage/congestion)
  },
  "battery-levels": {
    0.0: "#ef4444",   // Red (low battery)
    0.3: "#f97316",   // Orange
    0.5: "#eab308",   // Yellow
    0.7: "#84cc16",   // Lime
    1.0: "#22c55e",   // Green (full battery)
  },
  "activity": {
    0.0: "#1e293b",   // Slate (inactive)
    0.25: "#3b82f6",  // Blue
    0.5: "#8b5cf6",   // Violet
    0.75: "#d946ef",  // Fuchsia
    1.0: "#f43f5e",   // Rose (highly active)
  },
};

// Create a gradient image for the heatmap
function createGradient(gradient: Record<number, string>): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8ClampedArray(1024);

  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [stop, color] of Object.entries(gradient)) {
    grd.addColorStop(1 - parseFloat(stop), color);
  }
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 1, 256);

  return ctx.getImageData(0, 0, 1, 256).data;
}

// Draw a single heatmap point (radial gradient)
function drawPoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  intensity: number
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${intensity})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Colorize the grayscale heatmap
function colorize(
  imageData: ImageData,
  gradientArray: Uint8ClampedArray,
  opacity: number
) {
  const pixels = imageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha > 0) {
      const gradientIdx = Math.min(255, Math.floor(alpha)) * 4;
      pixels[i] = gradientArray[gradientIdx];
      pixels[i + 1] = gradientArray[gradientIdx + 1];
      pixels[i + 2] = gradientArray[gradientIdx + 2];
      pixels[i + 3] = Math.floor(alpha * opacity);
    }
  }
}

/**
 * HeatmapLayer - Canvas-based heatmap overlay for Leaflet
 */
export function HeatmapLayer({
  points,
  enabled = true,
  radius = 25,
  blur = 15,
  maxIntensity = 1.0,
  gradient = HEATMAP_GRADIENTS["node-density"],
  opacity = 0.6,
}: HeatmapLayerProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.ImageOverlay | null>(null);

  useEffect(() => {
    if (!enabled || points.length === 0) {
      // Remove existing layer
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    // Create or get canvas
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }

    const updateHeatmap = () => {
      if (!canvas) return;

      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply blur
      ctx.filter = `blur(${blur}px)`;

      // Draw all points
      for (const point of points) {
        const pixelPoint = map.latLngToContainerPoint([point.lat, point.lng]);
        const intensity = Math.min(point.intensity / maxIntensity, 1);
        drawPoint(ctx, pixelPoint.x, pixelPoint.y, radius, intensity);
      }

      // Reset filter
      ctx.filter = "none";

      // Get image data and colorize
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const gradientArray = createGradient(gradient);
      colorize(imageData, gradientArray, opacity);
      ctx.putImageData(imageData, 0, 0);

      // Get current map bounds
      const bounds = map.getBounds();

      // Remove old layer
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }

      // Create new overlay
      const imageUrl = canvas.toDataURL();
      layerRef.current = L.imageOverlay(imageUrl, bounds, {
        opacity: 1,
        interactive: false,
      });
      layerRef.current.addTo(map);
    };

    // Initial render
    updateHeatmap();

    // Update on map events
    map.on("moveend", updateHeatmap);
    map.on("zoomend", updateHeatmap);
    map.on("resize", updateHeatmap);

    return () => {
      map.off("moveend", updateHeatmap);
      map.off("zoomend", updateHeatmap);
      map.off("resize", updateHeatmap);
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points, enabled, radius, blur, maxIntensity, gradient, opacity]);

  return null;
}

export default HeatmapLayer;
