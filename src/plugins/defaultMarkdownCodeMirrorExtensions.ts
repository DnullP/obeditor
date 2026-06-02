import type { Extension } from "@codemirror/state";
import type { EditorCapabilitiesSource } from "../core/capabilities";
import { resolveEditorCapabilities } from "../core/capabilities";
import { setupVimEnhancedMotions } from "../core/vimChineseMotionExtension";
import {
  getRegisteredEditPluginExtensions,
} from "./editPluginRegistry";
import { ensureBuiltinEditPluginsRegistered } from "./registerBuiltinEditPlugins";
import { ensureBuiltinSyntaxRenderersRegistered } from "./registerBuiltinSyntaxRenderers";
import { ensureBuiltinVimHandoffsRegistered } from "./handoff/registerBuiltinVimHandoffs";
import {
  createRegisteredLineSyntaxRenderExtension,
} from "./syntaxRenderRegistry";
import { createCodeBlockHighlightExtension } from "./syntaxPlugins/codeBlockHighlightExtension";
import { createFrontmatterSyntaxExtension } from "./syntaxPlugins/frontmatterSyntaxExtension";
import { createImageEmbedSyntaxExtension } from "./syntaxPlugins/imageEmbedSyntaxExtension";
import { createLatexSyntaxExtension } from "./syntaxPlugins/latexSyntaxExtension";
import { createMarkdownTableSyntaxExtension } from "./syntaxPlugins/markdownTableSyntaxExtension";
import { createPasteImageExtension } from "./pasteImagePlugin";
import { createTaskCheckboxToggleExtension } from "./syntaxPlugins/listSyntaxRenderer";
import { createWikiLinkNavigationExtension } from "./syntaxPlugins/wikiLinkSyntaxRenderer";
import { createWikiLinkPreviewExtension } from "./syntaxPlugins/wikiLinkPreviewExtension";

export interface DefaultMarkdownCodeMirrorExtensionsOptions {
  getCurrentFilePath: () => string;
  capabilities?: EditorCapabilitiesSource;
  getCurrentDocumentContent?: () => string;
  canMutateDocument?: () => boolean;
  onRequestExitFrontmatterVimNavigation?: () => void;
  onRequestFocusFrontmatterVimNavigation?: (position: "first" | "last") => void;
  onRequestFocusMarkdownTableVimNavigation?: (request: {
    blockFrom: number;
    position: "first" | "last";
  }) => void;
}

export function ensureDefaultMarkdownCodeMirrorExtensionsRegistered(): void {
  ensureBuiltinSyntaxRenderersRegistered();
  ensureBuiltinEditPluginsRegistered();
  ensureBuiltinVimHandoffsRegistered();
  setupVimEnhancedMotions();
}

function asCodeMirrorExtension(extension: unknown): Extension {
  return extension as Extension;
}

export function createDefaultMarkdownCodeMirrorExtensions(
  options: DefaultMarkdownCodeMirrorExtensionsOptions,
): Extension[] {
  ensureDefaultMarkdownCodeMirrorExtensionsRegistered();

  const capabilities = options.capabilities;

  return [
    asCodeMirrorExtension(createFrontmatterSyntaxExtension({
      capabilities,
      onRequestExitVimNavigation: options.onRequestExitFrontmatterVimNavigation,
      onRequestFocusVimNavigation: options.onRequestFocusFrontmatterVimNavigation,
    })),
    asCodeMirrorExtension(createCodeBlockHighlightExtension()),
    ...createLatexSyntaxExtension().map(asCodeMirrorExtension),
    asCodeMirrorExtension(createMarkdownTableSyntaxExtension(
      options.getCurrentFilePath,
      {
        capabilities,
        onRequestFocusVimNavigation: options.onRequestFocusMarkdownTableVimNavigation,
      },
    )),
    asCodeMirrorExtension(createRegisteredLineSyntaxRenderExtension()),
    asCodeMirrorExtension(createTaskCheckboxToggleExtension()),
    asCodeMirrorExtension(createImageEmbedSyntaxExtension(
      options.getCurrentFilePath,
      { capabilities },
    )),
    asCodeMirrorExtension(createPasteImageExtension({
      getCurrentFilePath: options.getCurrentFilePath,
      capabilities,
      canMutateDocument: options.canMutateDocument,
    })),
    asCodeMirrorExtension(createWikiLinkPreviewExtension(
      options.getCurrentFilePath,
      {
        capabilities,
        getCurrentDocumentContent: options.getCurrentDocumentContent,
      },
    )),
    asCodeMirrorExtension(createWikiLinkNavigationExtension(
      options.getCurrentFilePath,
      {
        capabilities,
        getCurrentDocumentContent: options.getCurrentDocumentContent,
      },
    )),
    ...getRegisteredEditPluginExtensions({
      getCurrentFilePath: options.getCurrentFilePath,
      capabilities: resolveEditorCapabilities(capabilities),
    }),
  ];
}
