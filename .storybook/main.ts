import type { StorybookConfig } from "@storybook/react-vite";

const DND_KIT_PACKAGES = [
  "@dnd-kit/abstract",
  "@dnd-kit/collision",
  "@dnd-kit/dom",
  "@dnd-kit/helpers",
  "@dnd-kit/react",
];

const config: StorybookConfig = {
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  stories: ["../sidebar/**/*.stories.@(ts|tsx)", "../workspace/**/*.stories.@(ts|tsx)"],
  typescript: {
    check: false,
    reactDocgen: "react-docgen",
  },
  async viteFinal(config) {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        dedupe: [...(config.resolve?.dedupe ?? []), ...DND_KIT_PACKAGES],
      },
    };
  },
};

export default config;
