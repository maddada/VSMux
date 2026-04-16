import { spawnSync } from "node:child_process";
import { networkInterfaces } from "node:os";
import * as vscode from "vscode";

export type T3BrowserAccessMode = "external" | "local-network" | "local-only" | "tailscale";

export type T3BrowserAccessLink = {
  endpointUrl: string;
  localUrl: string;
  mode: T3BrowserAccessMode;
  note: string;
  tailscaleEnabled: boolean;
};

export type TailscaleStatus = {
  enabled: boolean;
  ipv4?: string;
};

const TAILSCALE_STATUS_CACHE_MS = 5_000;

let cachedTailscaleStatus:
  | {
      checkedAt: number;
      value: TailscaleStatus;
    }
  | undefined;

export async function resolveT3BrowserAccessLink(localUrl: string): Promise<T3BrowserAccessLink> {
  const parsedLocalUrl = new URL(localUrl);
  const tunneledUrl = await resolveExternalUrl(parsedLocalUrl);
  if (tunneledUrl) {
    return {
      endpointUrl: tunneledUrl,
      localUrl,
      mode: "external",
      note: "This link is being exposed by VS Code and can be opened outside the editor.",
      tailscaleEnabled: getTailscaleStatus().enabled,
    };
  }

  const tailscaleStatus = getTailscaleStatus();
  if (tailscaleStatus.ipv4) {
    return {
      endpointUrl: replaceUrlHost(parsedLocalUrl, tailscaleStatus.ipv4),
      localUrl,
      mode: "tailscale",
      note: "Scan this while your phone is connected to the same Tailnet.",
      tailscaleEnabled: true,
    };
  }

  const localNetworkHost = detectLocalNetworkHost();
  if (localNetworkHost) {
    return {
      endpointUrl: replaceUrlHost(parsedLocalUrl, localNetworkHost),
      localUrl,
      mode: "local-network",
      note: "This uses your machine's local network address because no Tailscale address was detected.",
      tailscaleEnabled: false,
    };
  }

  return {
    endpointUrl: localUrl,
    localUrl,
    mode: "local-only",
    note: "No Tailscale or LAN address was detected, so this link only works on this machine for now.",
    tailscaleEnabled: false,
  };
}

async function resolveExternalUrl(localUrl: URL): Promise<string | undefined> {
  try {
    const externalUri = await vscode.env.asExternalUri(vscode.Uri.parse(localUrl.toString()));
    const parsedExternalUrl = new URL(externalUri.toString());
    if (isLoopbackHost(parsedExternalUrl.hostname)) {
      return undefined;
    }
    return parsedExternalUrl.toString();
  } catch {
    return undefined;
  }
}

export function getTailscaleStatus(): TailscaleStatus {
  const now = Date.now();
  if (cachedTailscaleStatus && now - cachedTailscaleStatus.checkedAt <= TAILSCALE_STATUS_CACHE_MS) {
    return cachedTailscaleStatus.value;
  }

  const nextValue = detectTailscaleStatus();
  cachedTailscaleStatus = {
    checkedAt: now,
    value: nextValue,
  };
  return nextValue;
}

function detectTailscaleStatus(): TailscaleStatus {
  try {
    const result = spawnSync("tailscale", ["ip", "-4"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1_500,
      windowsHide: true,
    });
    if (result.status !== 0) {
      return { enabled: false };
    }

    const ipv4 = result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => isIpv4Host(line));
    if (!ipv4) {
      return { enabled: false };
    }
    return {
      enabled: true,
      ipv4,
    };
  } catch {
    return { enabled: false };
  }
}

function detectLocalNetworkHost(): string | undefined {
  const interfaces = networkInterfaces();
  const privateHosts: string[] = [];
  const publicHosts: string[] = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.internal || entry.family !== "IPv4" || !isIpv4Host(entry.address)) {
        continue;
      }

      if (isPrivateIpv4Host(entry.address)) {
        privateHosts.push(entry.address);
      } else {
        publicHosts.push(entry.address);
      }
    }
  }

  return privateHosts[0] ?? publicHosts[0];
}

function replaceUrlHost(url: URL, hostname: string): string {
  const nextUrl = new URL(url.toString());
  nextUrl.hostname = hostname;
  return nextUrl.toString();
}

function isIpv4Host(value: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/u.test(value);
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isPrivateIpv4Host(hostname: string): boolean {
  return (
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./u.test(hostname)
  );
}
