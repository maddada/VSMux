import { AlertTriangleIcon, PlayIcon, Trash2Icon, XIcon } from "lucide-react";
import {
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  CanvasAssetUris,
  CanvasUiSettings,
  TerminalPerformanceProfile,
  TerminalTileModel,
} from "../../shared/canvas-contract";
import type { TerminalSessionSnapshot } from "../../shared/terminal-host-protocol";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import {
  LiveGhosttyTerminal,
  type LiveGhosttyTerminalActions,
} from "@/components/live-ghostty-terminal";

type TerminalTileProps = {
  assetUris: CanvasAssetUris;
  isFocused: boolean;
  isRenaming: boolean;
  onRenameCancel: () => void;
  onRenameCommit: () => void;
  onRenameStart: (tileId: string) => void;
  onRenameValueChange: (value: string) => void;
  renderPerformance: TerminalPerformanceProfile;
  tile: TerminalTileModel;
  onClose: (tileId: string) => void;
  onDragStart: (event: ReactPointerEvent<HTMLDivElement>, tileId: string) => void;
  onFocus: (tileId: string) => void;
  onRestart: (tileId: string) => void;
  onResizeReset: (event: ReactMouseEvent<HTMLButtonElement>, tileId: string) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>, tileId: string) => void;
  onZoomToTile: (tileId: string) => void;
  renameValue: string;
  settings: CanvasUiSettings;
  session?: TerminalSessionSnapshot;
};

export const TerminalTile = ({
  assetUris,
  isFocused,
  isRenaming,
  tile,
  onClose,
  onDragStart,
  onFocus,
  onRestart,
  onResizeReset,
  onResizeStart,
  onZoomToTile,
  onRenameCancel,
  onRenameCommit,
  onRenameStart,
  onRenameValueChange,
  renderPerformance,
  renameValue,
  settings,
  session,
}: TerminalTileProps) => {
  const terminalActionsRef = useRef<LiveGhosttyTerminalActions | undefined>(undefined);
  const canRestart =
    session?.status === "disconnected" ||
    session?.status === "error" ||
    session?.status === "exited";
  const badgeLabel =
    session?.status === "running"
      ? "Live"
      : session?.status === "starting"
        ? "Booting"
        : session?.status === "disconnected"
          ? "Disconnected"
          : session?.status === "error"
            ? "Error"
            : "Exited";

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card
          className="absolute gap-0 overflow-hidden rounded-none border-border/80 bg-card py-0"
          data-canvas-tile="true"
          data-focused={isFocused}
          onPointerDown={(event) => {
            const target = event.target;
            if (target instanceof HTMLElement && target.closest("[data-focus-skip='true']")) {
              return;
            }

            onFocus(tile.id);
          }}
          style={{
            borderColor: isFocused ? "rgba(14, 165, 233, 0.9)" : undefined,
            height: tile.height,
            left: tile.x,
            outline: isFocused ? "2px solid rgba(14, 165, 233, 0.95)" : undefined,
            outlineOffset: 0,
            top: tile.y,
            width: tile.width,
          }}
        >
          <CardHeader
            className="flex cursor-grab flex-row items-center justify-between gap-0 border-b border-border/70 bg-linear-to-r from-stone-100/90 via-background to-sky-50/70 px-3 py-0.5 !pb-0.5 dark:border-white/8 dark:from-[#1b1f24] dark:via-[#171b20] dark:to-[#1b1f24] active:cursor-grabbing"
            data-focus-skip="true"
            onDoubleClick={() => onRenameStart(tile.id)}
            onPointerDown={(event) => {
              if (isRenaming) {
                return;
              }

              onDragStart(event, tile.id);
            }}
          >
            <div className="min-w-0 flex-1">
              {isRenaming ? (
                <Input
                  autoFocus
                  className="h-auto rounded-none border-0 bg-transparent px-0 py-0 text-sm font-medium shadow-none focus-visible:border-transparent focus-visible:ring-0"
                  onBlur={onRenameCommit}
                  onChange={(event) => onRenameValueChange(event.target.value)}
                  onFocus={(event) => {
                    event.currentTarget.select();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onRenameCommit();
                    }

                    if (event.key === "Escape") {
                      onRenameCancel();
                    }
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  value={renameValue}
                />
              ) : (
                <CardTitle className="truncate text-sm leading-none">{tile.title}</CardTitle>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                className="h-5 px-2 text-[0.7rem] leading-none"
                variant={
                  session?.status === "error"
                    ? "destructive"
                    : session?.status === "disconnected"
                      ? "outline"
                      : "secondary"
                }
              >
                {badgeLabel}
              </Badge>
              {canRestart ? (
                <Button
                  className="h-5 px-2 text-[0.7rem]"
                  onClick={() => onRestart(tile.id)}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon />
                  Restart
                </Button>
              ) : null}
              <Button
                aria-label={`Close ${tile.title}`}
                onClick={() => onClose(tile.id)}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </div>
          </CardHeader>
          <CardContent
            className="relative flex min-h-0 flex-1 flex-col bg-[#121417] pt-[15px] pr-0 pb-[15px] pl-[15px]"
            onClick={(event) => {
              const target = event.target;
              if (event.detail !== 3) {
                return;
              }

              if (target instanceof HTMLElement && target.closest("[data-focus-skip='true']")) {
                return;
              }

              onZoomToTile(tile.id);
            }}
          >
            <LiveGhosttyTerminal
              assetUris={assetUris}
              fontFamily={settings.terminalFontFamily}
              isFocused={isFocused}
              onTerminalActionsChange={(actions) => {
                terminalActionsRef.current = actions;
              }}
              performanceProfile={renderPerformance}
              session={session}
              tileId={tile.id}
            />
            <button
              aria-label={`Resize ${tile.title}`}
              className="absolute right-1.5 bottom-1.5 z-10 flex size-8 items-center justify-center rounded-none border border-white/10 bg-stone-950/60 text-white/70 opacity-0 shadow-sm transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100"
              data-focus-skip="true"
              onDoubleClick={(event) => onResizeReset(event, tile.id)}
              onPointerDown={(event) => onResizeStart(event, tile.id)}
              type="button"
            >
              <ResizeHandleIcon />
            </button>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuLabel>{tile.title}</ContextMenuLabel>
        </ContextMenuGroup>
        <ContextMenuItem
          onClick={() => {
            void terminalActionsRef.current?.copySelection();
          }}
        >
          Copy
        </ContextMenuItem>
        <ContextMenuSeparator />
        {canRestart ? (
          <ContextMenuItem onClick={() => onRestart(tile.id)}>
            <PlayIcon />
            Restart shell
          </ContextMenuItem>
        ) : null}
        {session?.status === "error" ? (
          <ContextMenuItem disabled>
            <AlertTriangleIcon />
            Shell failed
          </ContextMenuItem>
        ) : null}
        {canRestart || session?.status === "error" ? <ContextMenuSeparator /> : null}
        <ContextMenuItem onClick={() => onClose(tile.id)} variant="destructive">
          <Trash2Icon />
          Close tile
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

function ResizeHandleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M9 5H5v4" />
      <path d="M15 19h4v-4" />
      <path d="M5 5l6 6" />
      <path d="M19 19l-6-6" />
    </svg>
  );
}
