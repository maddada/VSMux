export const DEFAULT_SIDEBAR_COMMANDS = [
  {
    commandId: "dev",
    name: "Dev",
  },
  {
    commandId: "build",
    name: "Build",
  },
  {
    commandId: "test",
    name: "Test",
  },
  {
    commandId: "setup",
    name: "Setup",
  },
] as const;

export type DefaultSidebarCommandId = (typeof DEFAULT_SIDEBAR_COMMANDS)[number]["commandId"];

export type SidebarCommandButton = {
  closeTerminalOnExit: boolean;
  command?: string;
  commandId: string;
  isDefault: boolean;
  name: string;
};

export type StoredSidebarCommand = {
  closeTerminalOnExit: boolean;
  command: string;
  commandId: string;
  isDefault: boolean;
  name: string;
};

export function createDefaultSidebarCommandButtons(): SidebarCommandButton[] {
  return DEFAULT_SIDEBAR_COMMANDS.map((command) => ({
    closeTerminalOnExit: false,
    command: undefined,
    commandId: command.commandId,
    isDefault: true,
    name: command.name,
  }));
}

export function createSidebarCommandButtons(
  storedCommands: readonly StoredSidebarCommand[],
  storedOrder: readonly string[] = [],
  deletedDefaultCommandIds: readonly string[] = [],
): SidebarCommandButton[] {
  const storedCommandById = new Map(storedCommands.map((command) => [command.commandId, command]));
  const deletedDefaultCommandIdSet = new Set(normalizeStoredSidebarCommandOrder(deletedDefaultCommandIds));
  const defaultButtons = DEFAULT_SIDEBAR_COMMANDS.reduce<SidebarCommandButton[]>(
    (buttons, command) => {
      if (deletedDefaultCommandIdSet.has(command.commandId)) {
        return buttons;
      }

      const storedCommand = storedCommandById.get(command.commandId);
      buttons.push(
        storedCommand
          ? {
              closeTerminalOnExit: storedCommand.closeTerminalOnExit,
              command: storedCommand.command,
              commandId: storedCommand.commandId,
              isDefault: true,
              name: storedCommand.name,
            }
          : {
              closeTerminalOnExit: false,
              command: undefined,
              commandId: command.commandId,
              isDefault: true,
              name: command.name,
            },
      );
      return buttons;
    },
    [],
  );

  const customButtons = storedCommands
    .filter((command) => !isDefaultSidebarCommandId(command.commandId))
    .map((command) => ({
      closeTerminalOnExit: command.closeTerminalOnExit,
      command: command.command,
      commandId: command.commandId,
      isDefault: false,
      name: command.name,
    }));

  return orderSidebarCommandButtons([...defaultButtons, ...customButtons], storedOrder);
}

export function isDefaultSidebarCommandId(commandId: string): commandId is DefaultSidebarCommandId {
  return DEFAULT_SIDEBAR_COMMANDS.some((command) => command.commandId === commandId);
}

export function normalizeStoredSidebarCommands(candidate: unknown): StoredSidebarCommand[] {
  if (!Array.isArray(candidate)) {
    return [];
  }

  const normalizedCommands: StoredSidebarCommand[] = [];
  const seenCommandIds = new Set<string>();

  for (const item of candidate) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const partialItem = item as Partial<StoredSidebarCommand>;
    const commandId = partialItem.commandId?.trim();
    const name = partialItem.name?.trim();
    const command = partialItem.command?.trim();
    const isDefault =
      partialItem.isDefault === true || (commandId ? isDefaultSidebarCommandId(commandId) : false);

    if (
      !commandId ||
      !name ||
      !command ||
      typeof partialItem.closeTerminalOnExit !== "boolean" ||
      seenCommandIds.has(commandId)
    ) {
      continue;
    }

    normalizedCommands.push({
      closeTerminalOnExit: partialItem.closeTerminalOnExit,
      command,
      commandId,
      isDefault,
      name,
    });
    seenCommandIds.add(commandId);
  }

  return normalizedCommands;
}

export function normalizeStoredSidebarCommandOrder(candidate: unknown): string[] {
  if (!Array.isArray(candidate)) {
    return [];
  }

  const normalizedOrder: string[] = [];
  const seenCommandIds = new Set<string>();

  for (const item of candidate) {
    if (typeof item !== "string") {
      continue;
    }

    const commandId = item.trim();
    if (!commandId || seenCommandIds.has(commandId)) {
      continue;
    }

    normalizedOrder.push(commandId);
    seenCommandIds.add(commandId);
  }

  return normalizedOrder;
}

function orderSidebarCommandButtons(
  buttons: readonly SidebarCommandButton[],
  storedOrder: readonly string[],
): SidebarCommandButton[] {
  const buttonById = new Map(buttons.map((button) => [button.commandId, button] as const));
  const orderedButtons: SidebarCommandButton[] = [];

  for (const commandId of normalizeStoredSidebarCommandOrder(storedOrder)) {
    const button = buttonById.get(commandId);
    if (button) {
      orderedButtons.push(button);
    }
  }

  for (const button of buttons) {
    if (!orderedButtons.some((candidate) => candidate.commandId === button.commandId)) {
      orderedButtons.push(button);
    }
  }

  return orderedButtons;
}
