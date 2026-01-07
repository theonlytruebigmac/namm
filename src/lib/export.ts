import { Node, Message, Channel } from "@/types";

export function exportToJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${filename}.json`);
}

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    console.error("No data to export");
    return;
  }

  // Get all unique keys from the data
  const headers = Array.from(
    new Set(data.flatMap(item => Object.keys(item)))
  );

  // Create CSV content
  const csvContent = [
    headers.join(","),
    ...data.map(item =>
      headers
        .map(header => {
          const value = item[header];
          // Handle nested objects and arrays
          const stringValue = typeof value === "object"
            ? JSON.stringify(value)
            : String(value ?? "");
          // Escape quotes and wrap in quotes if contains comma
          return stringValue.includes(",") || stringValue.includes('"')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  downloadBlob(blob, `${filename}.csv`);
}

export function exportNodesToCSV(nodes: Node[]) {
  const flattenedNodes = nodes.map(node => ({
    id: node.id,
    shortName: node.shortName,
    longName: node.longName,
    role: node.role,
    batteryLevel: node.batteryLevel,
    voltage: node.voltage,
    snr: node.snr,
    rssi: node.rssi,
    lastHeard: new Date(node.lastHeard).toISOString(),
    latitude: node.position?.latitude,
    longitude: node.position?.longitude,
    altitude: node.position?.altitude,
    hopsAway: node.hopsAway,
    neighborCount: node.neighborCount,
    channelUtilization: node.channelUtilization,
    airUtilTx: node.airUtilTx,
  }));

  exportToCSV(flattenedNodes, `nodes_${new Date().toISOString().split("T")[0]}`);
}

export function exportMessagesToCSV(messages: Message[]) {
  const flattenedMessages = messages.map(msg => ({
    id: msg.id,
    fromNode: msg.fromNode,
    toNode: msg.toNode,
    channel: msg.channel,
    text: msg.text,
    timestamp: new Date(msg.timestamp).toISOString(),
    hopLimit: msg.hopLimit,
  }));

  exportToCSV(flattenedMessages, `messages_${new Date().toISOString().split("T")[0]}`);
}

export function exportNetworkSnapshot(
  nodes: Node[],
  messages: Message[],
  channels: Channel[]
) {
  const snapshot = {
    exportDate: new Date().toISOString(),
    summary: {
      totalNodes: nodes.length,
      activeNodes: nodes.filter(n => Date.now() - n.lastHeard < 3600000).length,
      totalMessages: messages.length,
      totalChannels: channels.length,
    },
    nodes,
    messages,
    channels,
  };

  exportToJSON(snapshot, `network_snapshot_${new Date().toISOString().split("T")[0]}`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
