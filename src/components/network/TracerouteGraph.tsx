"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { NodeObject, LinkObject } from "react-force-graph-2d";
import { Node } from "@/types";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-[hsl(var(--muted))] rounded-lg">
      <p className="text-[hsl(var(--muted-foreground))]">Loading graph...</p>
    </div>
  ),
});

interface TracerouteGraphProps {
  nodes: Node[];
  route: number[];
  routeBack?: number[];
  highlightNodes?: Set<number>;
}

interface GraphNode extends NodeObject {
  id: string;
  nodeNum: number;
  name: string;
  role: string;
  isOnline: boolean;
  isInRoute: boolean;
  routeIndex: number; // -1 if not in route, 0-based index if in route
  isReturnRoute: boolean;
}

interface GraphLink extends LinkObject {
  source: string | GraphNode;
  target: string | GraphNode;
  isRouteLink: boolean;
  isReturnLink: boolean;
  linkIndex: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function TracerouteGraph({ nodes, route, routeBack, highlightNodes }: TracerouteGraphProps) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Create graph data from nodes and route
  const graphData = useCallback((): GraphData => {
    const routeSet = new Set(route);
    const routeBackSet = new Set(routeBack || []);

    // Filter nodes to only include those in the route (and a few neighbors for context)
    const routeNodeNums = new Set([...route, ...(routeBack || [])]);

    const relevantNodes = nodes.filter((node) => {
      const nodeNum = parseInt(node.id.replace("!", ""), 16);
      return routeNodeNums.has(nodeNum) || highlightNodes?.has(nodeNum);
    });

    const graphNodes: GraphNode[] = relevantNodes.map((node) => {
      const nodeNum = parseInt(node.id.replace("!", ""), 16);
      const forwardIndex = route.indexOf(nodeNum);
      const backIndex = routeBack?.indexOf(nodeNum) ?? -1;

      return {
        id: node.id,
        nodeNum,
        name: node.shortName || node.longName || `Node ${node.id}`,
        role: node.role || "CLIENT",
        isOnline: node.lastHeard ? Date.now() - node.lastHeard < 3600000 : false,
        isInRoute: routeSet.has(nodeNum) || routeBackSet.has(nodeNum),
        routeIndex: forwardIndex >= 0 ? forwardIndex : backIndex,
        isReturnRoute: forwardIndex < 0 && backIndex >= 0,
      };
    });

    // Create links for the route
    const graphLinks: GraphLink[] = [];

    // Forward route links
    for (let i = 0; i < route.length - 1; i++) {
      const sourceId = `!${route[i].toString(16).padStart(8, "0")}`;
      const targetId = `!${route[i + 1].toString(16).padStart(8, "0")}`;

      // Only add link if both nodes exist
      if (graphNodes.find((n) => n.id === sourceId) && graphNodes.find((n) => n.id === targetId)) {
        graphLinks.push({
          source: sourceId,
          target: targetId,
          isRouteLink: true,
          isReturnLink: false,
          linkIndex: i,
        });
      }
    }

    // Return route links
    if (routeBack) {
      for (let i = 0; i < routeBack.length - 1; i++) {
        const sourceId = `!${routeBack[i].toString(16).padStart(8, "0")}`;
        const targetId = `!${routeBack[i + 1].toString(16).padStart(8, "0")}`;

        if (graphNodes.find((n) => n.id === sourceId) && graphNodes.find((n) => n.id === targetId)) {
          graphLinks.push({
            source: sourceId,
            target: targetId,
            isRouteLink: false,
            isReturnLink: true,
            linkIndex: i,
          });
        }
      }
    }

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, route, routeBack, highlightNodes]);

  // Node painting function
  const paintNode = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      const { x, y, name, isInRoute, routeIndex, isReturnRoute } = graphNode;

      if (x === undefined || y === undefined) return;

      const size = isInRoute ? 8 : 5;
      const fontSize = Math.max(10 / globalScale, 3);

      // Draw node circle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);

      if (isInRoute) {
        // Route nodes: green for forward, purple for return
        ctx.fillStyle = isReturnRoute ? "#8839ef" : "#40a02b"; // Mauve : Green
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = "#6c6f85"; // Overlay
        ctx.strokeStyle = "transparent";
      }

      ctx.fill();
      if (isInRoute) ctx.stroke();

      // Draw hop number for route nodes
      if (isInRoute && routeIndex >= 0) {
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${fontSize}px Sans-Serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${routeIndex + 1}`, x, y);
      }

      // Draw label below
      ctx.fillStyle = isInRoute ? "#e6e9ef" : "#9ca0b0";
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(name, x, y + size + 2);
    },
    []
  );

  // Link painting function
  const paintLink = useCallback(
    (link: LinkObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphLink = link as GraphLink;
      const start = graphLink.source as GraphNode;
      const end = graphLink.target as GraphNode;

      if (!start.x || !start.y || !end.x || !end.y) return;

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);

      if (graphLink.isRouteLink) {
        ctx.strokeStyle = "#40a02b"; // Green
        ctx.lineWidth = 3;
      } else if (graphLink.isReturnLink) {
        ctx.strokeStyle = "#8839ef"; // Mauve
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
      } else {
        ctx.strokeStyle = "#6c6f85";
        ctx.lineWidth = 1;
      }

      ctx.stroke();
      ctx.setLineDash([]);

      // Draw arrow
      if (graphLink.isRouteLink || graphLink.isReturnLink) {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const arrowLength = 8;
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;

        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(
          midX - arrowLength * Math.cos(angle - Math.PI / 6),
          midY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(midX, midY);
        ctx.lineTo(
          midX - arrowLength * Math.cos(angle + Math.PI / 6),
          midY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
    },
    []
  );

  if (!mounted) {
    return (
      <div
        ref={containerRef}
        className="h-full w-full flex items-center justify-center bg-[hsl(var(--muted))] rounded-lg"
      >
        <p className="text-[hsl(var(--muted-foreground))]">Loading graph...</p>
      </div>
    );
  }

  const data = graphData();

  if (data.nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="h-full w-full flex items-center justify-center bg-[hsl(var(--muted))] rounded-lg"
      >
        <p className="text-[hsl(var(--muted-foreground))]">No route data available</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full bg-[hsl(var(--muted))] rounded-lg overflow-hidden">
      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={paintNode}
        linkCanvasObject={paintLink}
        nodePointerAreaPaint={(node, color, ctx) => {
          const graphNode = node as GraphNode;
          const size = graphNode.isInRoute ? 8 : 5;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, size + 2, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        cooldownTime={1000}
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.3}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
    </div>
  );
}
