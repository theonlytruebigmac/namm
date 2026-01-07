"use client";

import { useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Node } from "@/types";

interface NetworkGraphProps {
  nodes: Node[];
}

interface GraphNode {
  id: string;
  name: string;
  role: string;
  isOnline: boolean;
  batteryLevel?: number;
}

interface GraphLink {
  source: string;
  target: string;
  strength: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function NetworkGraph({ nodes }: NetworkGraphProps) {
  const [mounted, setMounted] = useState(false);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    // Update dimensions on mount and resize
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading network graph...</p>
      </div>
    );
  }

  // Transform nodes for graph
  const graphNodes: GraphNode[] = nodes.map(node => ({
    id: node.id,
    name: node.shortName || node.longName || `Node ${node.id}`,
    role: node.role || "CLIENT",
    isOnline: node.lastHeard ? Date.now() - node.lastHeard < 3600000 : false,
    batteryLevel: node.batteryLevel
  }));

  // Create links between nodes (simplified - in reality would use routing table)
  const graphLinks: GraphLink[] = [];
  const activeNodes = graphNodes.filter(n => n.isOnline);

  // Create a hub-and-spoke topology with routers as hubs
  const routers = activeNodes.filter(n =>
    n.role === "ROUTER" || n.role === "ROUTER_CLIENT"
  );
  const clients = activeNodes.filter(n =>
    n.role !== "ROUTER" && n.role !== "ROUTER_CLIENT"
  );

  // Connect routers to each other
  for (let i = 0; i < routers.length; i++) {
    for (let j = i + 1; j < routers.length; j++) {
      graphLinks.push({
        source: routers[i].id,
        target: routers[j].id,
        strength: 0.8 + Math.random() * 0.2
      });
    }
  }

  // Connect clients to nearest routers
  clients.forEach(client => {
    if (routers.length > 0) {
      const router = routers[Math.floor(Math.random() * Math.min(routers.length, 2))];
      graphLinks.push({
        source: client.id,
        target: router.id,
        strength: 0.5 + Math.random() * 0.3
      });
    }
  });

  // If no routers, create a mesh among active clients
  if (routers.length === 0 && clients.length > 1) {
    for (let i = 0; i < clients.length; i++) {
      const connectTo = Math.min(i + 2, clients.length);
      for (let j = i + 1; j < connectTo; j++) {
        graphLinks.push({
          source: clients[i].id,
          target: clients[j].id,
          strength: 0.6 + Math.random() * 0.2
        });
      }
    }
  }

  const graphData: GraphData = {
    nodes: graphNodes,
    links: graphLinks
  };

  // Color based on role
  const getNodeColor = (node: GraphNode) => {
    if (!node.isOnline) return "#6b7280";

    switch (node.role) {
      case "ROUTER":
      case "ROUTER_CLIENT":
        return "#22c55e"; // green
      case "CLIENT":
      case "CLIENT_MUTE":
        return "#3b82f6"; // blue
      case "REPEATER":
        return "#a855f7"; // purple
      case "TRACKER":
        return "#f59e0b"; // amber
      default:
        return "#10b981"; // emerald
    }
  };

  // Get node size based on role and battery
  const getNodeSize = (node: GraphNode) => {
    const baseSize = node.role === "ROUTER" || node.role === "ROUTER_CLIENT" ? 8 : 6;
    return node.isOnline ? baseSize : baseSize * 0.7;
  };

  return (
    <div ref={containerRef} className="h-full w-full bg-background">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="transparent"
        nodeLabel={(node: any) => {
          const n = node as GraphNode;
          return `${n.name} (${n.role})${n.batteryLevel ? ` - ${n.batteryLevel}%` : ''}`;
        }}
        nodeColor={(node: any) => getNodeColor(node as GraphNode)}
        nodeRelSize={6}
        nodeVal={(node: any) => getNodeSize(node as GraphNode)}
        linkColor={(link: any) => {
          const l = link as GraphLink;
          const opacity = Math.floor(l.strength * 255).toString(16).padStart(2, '0');
          return `#10b981${opacity}`;
        }}
        linkWidth={(link: any) => {
          const l = link as GraphLink;
          return l.strength * 2;
        }}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.005}
        cooldownTicks={100}
        onEngineStop={() => {
          if (graphRef.current) {
            graphRef.current.zoomToFit(400, 50);
          }
        }}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const n = node as GraphNode & { x: number; y: number };
          const label = n.name;
          const fontSize = 12 / globalScale;
          const nodeSize = getNodeSize(n);

          // Draw node circle
          ctx.beginPath();
          ctx.arc(n.x, n.y, nodeSize, 0, 2 * Math.PI);
          ctx.fillStyle = getNodeColor(n);
          ctx.fill();

          // Draw border for online nodes
          if (n.isOnline) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2 / globalScale;
            ctx.stroke();
          }

          // Draw label
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, n.x, n.y + nodeSize + fontSize);
        }}
      />
    </div>
  );
}
