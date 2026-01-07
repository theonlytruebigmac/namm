"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ForceGraph3D from "react-force-graph-3d";
import { Node } from "@/types";
import * as THREE from "three";

interface NetworkGraph3DProps {
  nodes: Node[];
  onNodeClick?: (nodeId: string) => void;
  highlightNode?: string | null;
}

interface GraphNode {
  id: string;
  name: string;
  role: string;
  isOnline: boolean;
  batteryLevel?: number;
  x?: number;
  y?: number;
  z?: number;
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

// Role-based colors
const getRoleColor = (role: string, isOnline: boolean) => {
  if (!isOnline) return 0x6b7280; // gray

  switch (role) {
    case "ROUTER":
    case "ROUTER_CLIENT":
      return 0x22c55e; // green
    case "CLIENT":
    case "CLIENT_MUTE":
      return 0x3b82f6; // blue
    case "REPEATER":
      return 0xa855f7; // purple
    case "TRACKER":
      return 0xf59e0b; // amber
    default:
      return 0x10b981; // emerald
  }
};

export function NetworkGraph3D({ nodes, onNodeClick, highlightNode }: NetworkGraph3DProps) {
  const [mounted, setMounted] = useState(false);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

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

  // Auto-rotate the camera
  useEffect(() => {
    if (graphRef.current) {
      // Set up camera controls
      const controls = graphRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
      }
    }
  }, [mounted]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
      // Focus on clicked node
      if (graphRef.current) {
        const distance = 200;
        const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
        graphRef.current.cameraPosition(
          {
            x: (node.x || 0) * distRatio,
            y: (node.y || 0) * distRatio,
            z: (node.z || 0) * distRatio,
          },
          node,
          2000
        );
      }
    },
    [onNodeClick]
  );

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading 3D network graph...</p>
      </div>
    );
  }

  // Transform nodes for graph
  const graphNodes: GraphNode[] = nodes.map((node) => ({
    id: node.id,
    name: node.shortName || node.longName || `Node ${node.id}`,
    role: node.role || "CLIENT",
    isOnline: node.lastHeard ? Date.now() - node.lastHeard < 3600000 : false,
    batteryLevel: node.batteryLevel,
  }));

  // Create links between nodes
  const graphLinks: GraphLink[] = [];
  const activeNodes = graphNodes.filter((n) => n.isOnline);

  // Create topology with routers as hubs
  const routers = activeNodes.filter(
    (n) => n.role === "ROUTER" || n.role === "ROUTER_CLIENT"
  );
  const clients = activeNodes.filter(
    (n) => n.role !== "ROUTER" && n.role !== "ROUTER_CLIENT"
  );

  // Connect routers to each other
  for (let i = 0; i < routers.length; i++) {
    for (let j = i + 1; j < routers.length; j++) {
      graphLinks.push({
        source: routers[i].id,
        target: routers[j].id,
        strength: 0.8 + Math.random() * 0.2,
      });
    }
  }

  // Connect clients to routers
  clients.forEach((client) => {
    if (routers.length > 0) {
      const router = routers[Math.floor(Math.random() * Math.min(routers.length, 2))];
      graphLinks.push({
        source: client.id,
        target: router.id,
        strength: 0.3 + Math.random() * 0.4,
      });
    } else if (clients.length > 1) {
      // If no routers, connect to another random client
      const otherClients = clients.filter((c) => c.id !== client.id);
      if (otherClients.length > 0) {
        const target = otherClients[Math.floor(Math.random() * otherClients.length)];
        graphLinks.push({
          source: client.id,
          target: target.id,
          strength: 0.2 + Math.random() * 0.3,
        });
      }
    }
  });

  const graphData: GraphData = {
    nodes: graphNodes,
    links: graphLinks,
  };

  return (
    <div ref={containerRef} className="h-full w-full relative">
      <ForceGraph3D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        nodeLabel={(node: GraphNode) =>
          `<div style="background: rgba(0,0,0,0.8); padding: 8px 12px; border-radius: 4px; color: white;">
            <strong>${node.name}</strong><br/>
            <span style="color: #888;">${node.role}</span><br/>
            ${node.isOnline ? '<span style="color: #22c55e;">● Online</span>' : '<span style="color: #6b7280;">○ Offline</span>'}
            ${node.batteryLevel !== undefined ? `<br/>Battery: ${node.batteryLevel}%` : ""}
          </div>`
        }
        nodeColor={(node: GraphNode) => {
          const baseColor = getRoleColor(node.role, node.isOnline);
          if (node.id === highlightNode || node.id === hoveredNode) {
            return "#ffffff";
          }
          return `#${baseColor.toString(16).padStart(6, "0")}`;
        }}
        nodeVal={(node: GraphNode) => {
          // Size based on role
          if (node.role === "ROUTER" || node.role === "ROUTER_CLIENT") return 8;
          if (node.role === "REPEATER") return 6;
          return 4;
        }}
        nodeThreeObject={(node: GraphNode) => {
          const size = node.role === "ROUTER" || node.role === "ROUTER_CLIENT" ? 8 : 4;
          const color = getRoleColor(node.role, node.isOnline);

          // Create a sphere with glow effect for online nodes
          const geometry = new THREE.SphereGeometry(size, 16, 16);
          const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: node.isOnline ? color : 0x000000,
            emissiveIntensity: node.isOnline ? 0.3 : 0,
            transparent: !node.isOnline,
            opacity: node.isOnline ? 1 : 0.5,
          });

          const sphere = new THREE.Mesh(geometry, material);

          // Add highlight ring for highlighted node
          if (node.id === highlightNode) {
            const ringGeometry = new THREE.TorusGeometry(size * 1.5, 1, 16, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            sphere.add(ring);
          }

          return sphere;
        }}
        linkWidth={(link: GraphLink) => link.strength * 2}
        linkColor={() => "rgba(100, 150, 200, 0.4)"}
        linkOpacity={0.6}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.005}
        onNodeClick={handleNodeClick}
        onNodeHover={(node: GraphNode | null) => setHoveredNode(node?.id || null)}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-[hsl(var(--card))] p-3 rounded-lg border border-border text-sm space-y-2">
        <div className="font-medium text-foreground mb-2">Node Types</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Router</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-muted-foreground">Client</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-muted-foreground">Repeater</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-muted-foreground">Tracker</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span className="text-muted-foreground">Offline</span>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute top-4 right-4 bg-[hsl(var(--card))] p-2 rounded-lg border border-border text-xs text-muted-foreground">
        <div>🖱️ Drag to rotate</div>
        <div>🔍 Scroll to zoom</div>
        <div>👆 Click node to focus</div>
      </div>
    </div>
  );
}
