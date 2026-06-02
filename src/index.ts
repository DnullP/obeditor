export type {
  EditorCapabilities,
  EditorCapabilityListener,
  EditorCapabilityRegistry,
  EditorHostCapabilities,
  EditorLocalizationCapabilities,
  EditorMediaEmbedCapabilities,
  EditorMediaEmbedContext,
  EditorMediaEmbedBinaryResult,
  EditorMediaEmbedResolvedTarget,
  EditorTextSegmentationCapabilities,
  EditorTextSegmentationContext,
  EditorTextSegment,
  EditorCapabilitiesSource,
  EditorContextMenuCapabilities,
  EditorContextMenuItem,
  EditorContextMenuTrigger,
  EditorWikiLinkCapabilities,
  EditorWikiLinkCustomPreview,
  EditorWikiLinkMarkdownPreview,
  EditorWikiLinkPreview,
  EditorWikiLinkResolvedTarget,
  EditorWikiLinkSuggestionItem,
  EditorWikiLinkSuggestionItem as WikiLinkSuggestionItem,
  EditorWikiLinkTargetContext,
} from "./core/capabilities";
export {
  createEditorCapabilityRegistry,
  EMPTY_EDITOR_CAPABILITIES,
  openEditorWikiLinkTarget,
  previewEditorWikiLinkTarget,
  resolveEditorCapabilities,
  resolveEditorWikiLinkTarget,
  suggestEditorWikiLinkTargets,
  translateEditorText,
  translateEditorTextFromSource,
} from "./core/capabilities";
export type {
  EditorCommand,
  EditorCommandContext,
  EditorCommandDescriptor,
  EditorDocument,
  EditorDocumentRef,
  EditorHostAdapter,
  EditorMode,
  EditorPlugin,
  EditorPluginContext,
  EditorPluginContribution,
  EditorService,
  EditorServiceOptions,
  EditorSnapshot,
  EditorStatus,
  EditorRuntimeExtension,
  EditorSurfaceHandle,
  EditorViewAttachOptions,
} from "./core/types";
export { createEditorService } from "./core/editorService";
export { editorBaseSetup } from "./core/editorBaseSetup";
export { createEditorThemeExtension } from "./core/codemirrorTheme";
export {
  focusEditorViewPreservingViewport,
} from "./core/editorActivationFocus";
export {
  resolveEditorBodyAnchor,
  resolveEditorBodySelectionRange,
} from "./core/editorBodyAnchor";
export type {
  EditorBodySelectionRange,
} from "./core/editorBodyAnchor";
export {
  createEditorChineseSegmentationController,
} from "./core/editorChineseSegmentation";
export type {
  CreateEditorChineseSegmentationControllerOptions,
  EditorChineseSegmentationController,
} from "./core/editorChineseSegmentation";
export {
  findEditorTabOutTarget,
  createEditorTabOutKeymap,
  runEditorTabOut,
} from "./core/editorTabOutExtension";
export type {
  EditorTabOutTarget,
} from "./core/editorTabOutExtension";
export {
  buildUnifiedLineSegments,
  classifyChar,
  containsChineseCharacter,
  findWordInLine,
  getChineseWordRangeAtCursor,
  getWordObjectRange,
  normalizeChineseMotionTokens,
  resolveChineseMotionOffset,
  resolveChinesePreviousWordBoundary,
  resolveEnglishPreviousWordBoundary,
} from "./core/editorWordBoundaries";
export type {
  ChineseSegmentToken,
  LineSegment,
  SegmentKind,
  WordRange,
} from "./core/editorWordBoundaries";
export {
  buildLineNumbersExtension,
} from "./core/lineNumbersModeExtension";
export {
  createRelativeLineNumbersExtension,
} from "./core/relativeLineNumbersExtension";
export {
  registerVimTokenProvider,
  setupVimEnhancedMotions,
  unregisterVimTokenProvider,
} from "./core/vimChineseMotionExtension";
export { UniversalMarkdownEditor } from "./components/UniversalMarkdownEditor";
export type { UniversalMarkdownEditorProps } from "./components/UniversalMarkdownEditor";
export { CodeMirrorMarkdownSurface } from "./components/CodeMirrorMarkdownSurface";
export type { CodeMirrorMarkdownSurfaceProps } from "./components/CodeMirrorMarkdownSurface";
export {
  MarkdownReadView,
  revealMarkdownReadViewLine,
  shouldKeepReadModeWikiLinkPreviewHovered,
} from "./components/MarkdownReadView";
export type { MarkdownReadViewProps } from "./components/MarkdownReadView";
export { EditorToolbar } from "./components/EditorToolbar";
export type { EditorToolbarProps } from "./components/EditorToolbar";
export { useEditorSnapshot } from "./react/useEditorSnapshot";
export { createDefaultMarkdownPlugins } from "./plugins/defaultMarkdownPlugins";
export {
  createDefaultMarkdownCodeMirrorExtensions,
  ensureDefaultMarkdownCodeMirrorExtensionsRegistered,
} from "./plugins/defaultMarkdownCodeMirrorExtensions";
export type {
  DefaultMarkdownCodeMirrorExtensionsOptions,
} from "./plugins/defaultMarkdownCodeMirrorExtensions";
export { createMarkdownFormattingPlugin } from "./plugins/markdownFormattingPlugin";
export { createLinkOpenPlugin } from "./plugins/linkOpenPlugin";
export {
  attachPasteImageHandler,
  blobToBase64,
  buildImageEmbedSyntax,
  buildPasteImageAssetRequest,
  createPasteImageExtension,
  generatePastedImageFileName,
  resolveImageRelativePath,
} from "./plugins/pasteImagePlugin";
export type {
  PasteImageAssetRequest,
  PasteImageDependencies,
} from "./plugins/pasteImagePlugin";
export {
  getRegisteredEditPluginExtensions,
  registerEditPlugin,
  unregisterEditPlugin,
} from "./plugins/editPluginRegistry";
export type {
  EditPluginContext,
  EditPluginRegistration,
} from "./plugins/editPluginRegistry";
export { ensureBuiltinEditPluginsRegistered } from "./plugins/registerBuiltinEditPlugins";
export {
  buildWikiLinkSuggestionAcceptance,
  detectOpenWikiLink,
  OPEN_WIKILINK_PATTERN,
  resolveWikiLinkClosingBracketResolution,
  resolveWikiLinkSuggestionAcceptanceAtCursor,
} from "./plugins/editPlugins/wikilinkSuggestUtils";
export type {
  OpenWikiLinkMatch,
  WikiLinkClosingBracketResolution,
  WikiLinkSuggestionAcceptance,
} from "./plugins/editPlugins/wikilinkSuggestUtils";
export {
  mapSuggestStateThroughTransaction,
  registerWikiLinkSuggestEditPlugin,
} from "./plugins/editPlugins/wikilinkSuggestEditPlugin";
export {
  detectExcludedLineRanges,
  isLineExcluded,
} from "./markdown/markdownBlockDetector";
export type {
  BlockType,
  ExcludedLineRange,
} from "./markdown/markdownBlockDetector";
export {
  parseImageEmbedTarget,
  serializeImageEmbedSyntax,
  serializeImageEmbedTarget,
} from "./markdown/imageEmbedLayout";
export type {
  ImageEmbedLayout,
  ParsedImageEmbedTarget,
} from "./markdown/imageEmbedLayout";
export {
  resolveMarkdownNoteTitle,
  resolveRenamedMarkdownPath,
} from "./markdown/noteTitleUtils";
export {
  buildFrontmatterTemplateVariables,
  expandFrontmatterTemplate,
  normalizeFrontmatterBlock,
} from "./markdown/frontmatterTemplate";
export type {
  FrontmatterTemplateVariables,
} from "./markdown/frontmatterTemplate";
export {
  decodeReadModeBlockLatexHref,
  decodeReadModeHighlightHref,
  decodeReadModeInlineLatexHref,
  decodeReadModeMediaEmbedHref,
  decodeReadModeTagHref,
  decodeReadModeWikiLinkHref,
  prepareMarkdownForReadMode,
  READ_MODE_BLOCK_LATEX_PROTOCOL,
  READ_MODE_INLINE_HIGHLIGHT_PROTOCOL,
  READ_MODE_INLINE_LATEX_PROTOCOL,
  READ_MODE_INLINE_TAG_PROTOCOL,
  READ_MODE_MEDIA_EMBED_PROTOCOL,
  READ_MODE_WIKILINK_PROTOCOL,
  transformMarkdownForReadMode,
} from "./markdown/markdownReadTransform";
export type {
  PreparedReadModeMarkdown,
  ReadModeFrontmatterField,
} from "./markdown/markdownReadTransform";
export {
  describeRenderFeature,
  getReadModeUnsupportedFeatures,
} from "./markdown/renderParityContract";
export type {
  EditorRenderFeature,
} from "./markdown/renderParityContract";
export {
  detectUsedEnhancedRenderFeatures,
  evaluateReadModeRenderGuard,
} from "./markdown/readModeRenderGuard";
export type {
  ReadModeRenderGuardResult,
} from "./markdown/readModeRenderGuard";
export {
  shouldSkipWikiLinkNavigationForSelection,
} from "./markdown/readModeSelectionPolicy";
export type {
  SelectionLike,
  SelectionRangeLike,
} from "./markdown/readModeSelectionPolicy";
export {
  parseWikiLinkParts,
} from "./markdown/wikiLinkParser";
export type {
  ParsedWikiLinkParts,
} from "./markdown/wikiLinkParser";
export {
  normalizeWikiLinkAnchorText,
  parseWikiLinkSubtarget,
  parseWikiLinkTarget,
  resolveWikiLinkSubtarget,
} from "./markdown/wikiLinkSubtarget";
export type {
  ParsedWikiLinkTarget,
  ResolvedWikiLinkSubtarget,
  WikiLinkSubtarget,
} from "./markdown/wikiLinkSubtarget";
export {
  cloneMarkdownTableModel,
  createDefaultMarkdownTableModel,
  deleteMarkdownTableColumnAt,
  deleteMarkdownTableRowAt,
  hasMarkdownTableLayout,
  insertMarkdownTableColumnAt,
  insertMarkdownTableRowAt,
  moveMarkdownTableColumn,
  moveMarkdownTableRow,
  parseMarkdownTableLayoutComment,
  parseMarkdownTableLines,
  serializeMarkdownTable,
  serializeMarkdownTableLayoutComment,
  serializeMarkdownTableWithLayout,
  splitMarkdownTableCells,
  updateMarkdownTableCell,
} from "./markdown/markdownTableModel";
export type {
  MarkdownTableAlignment,
  MarkdownTableCellPosition,
  MarkdownTableLayout,
  MarkdownTableModel,
} from "./markdown/markdownTableModel";
export {
  normalizeMarkdownTableCellPreviewSource,
  prepareMarkdownTableCellPreviewMarkdown,
} from "./markdown/markdownTableCellPreview";
export {
  getMarkdownTableCellFlatIndex,
  resolveInitialRichPreviewLimit,
} from "./markdown/markdownTablePreviewPolicy";
export {
  estimateMarkdownTableBodyRowHeights,
  estimateMarkdownTableRowHeight,
  estimateMarkdownTableWidgetHeight,
  MARKDOWN_TABLE_HEADER_HEIGHT,
  MARKDOWN_TABLE_MIN_ROW_HEIGHT,
  MARKDOWN_TABLE_VERTICAL_CHROME_HEIGHT,
} from "./markdown/markdownTableRowHeightEstimate";
export {
  MARKDOWN_TABLE_ROW_VIRTUALIZATION_OVERSCAN,
  MARKDOWN_TABLE_ROW_VIRTUALIZATION_THRESHOLD,
  resolveMarkdownTableVirtualRange,
  shouldVirtualizeMarkdownTableRows,
} from "./markdown/markdownTableVirtualization";
export type {
  MarkdownTableVirtualRange,
} from "./markdown/markdownTableVirtualization";
export {
  resolveMarkdownTableBodyTopInScroller,
  resolveMarkdownTableVirtualViewport,
} from "./markdown/markdownTableVirtualViewport";
export type {
  MarkdownTableVirtualViewport,
  MarkdownTableVirtualViewportGeometry,
} from "./markdown/markdownTableVirtualViewport";
export {
  clampMarkdownTableForwardedScrollTop,
  MarkdownTableWheelForwarder,
  resolveMarkdownTableEditorWheelDeltaY,
} from "./markdown/markdownTableWheelForwarding";
export type {
  MarkdownTableEditorWheelDeltaOptions,
} from "./markdown/markdownTableWheelForwarding";
export {
  resolveParentDirectory,
} from "./plugins/pathUtils";
export {
  insertFrontmatter,
  insertLink,
  insertTable,
  insertTask,
  toggleBlockLatex,
  toggleBold,
  toggleHighlight,
  toggleInlineCode,
  toggleInlineLatex,
  toggleItalic,
  toggleStrikethrough,
  toggleWikiLink,
} from "./plugins/markdownFormattingCommands";
export type {
  FrontmatterInsertContext,
} from "./plugins/markdownFormattingCommands";
export {
  addDelimitedInlineSyntaxDecoration,
  addInlineSyntaxDecoration,
  createRegisteredLineSyntaxRenderExtension,
  getLineSyntaxRendererSnapshot,
  pushLineSyntaxDecoration,
  pushSyntaxDecorationRange,
  rangeIntersectsSelection,
  registerLineSyntaxRenderer,
  setLineSyntaxImeCompositionActive,
  shouldApplyLineSyntaxRenderer,
  shouldSuppressLineSyntaxRendering,
} from "./plugins/syntaxRenderRegistry";
export type {
  LineSyntaxDecorationContext,
  LineSyntaxRendererRegistration,
  SyntaxDecorationRange,
} from "./plugins/syntaxRenderRegistry";
export {
  clearExclusionZones,
  isInsideExclusionZone,
  isInsideHigherPriorityZone,
  isRangeInsideExclusionZone,
  isRangeInsideHigherPriorityZone,
  setExclusionZones,
} from "./plugins/syntaxExclusionZones";
export type {
  ExclusionZone,
  ExclusionZoneOwner,
} from "./plugins/syntaxExclusionZones";
export {
  ensureBuiltinSyntaxRenderersRegistered,
} from "./plugins/registerBuiltinSyntaxRenderers";
export {
  computeTagColorStyles,
} from "./plugins/utils/tagColor";
export {
  registerBlockquoteSyntaxRenderer,
} from "./plugins/syntaxPlugins/blockquoteSyntaxRenderer";
export {
  registerBoldSyntaxRenderer,
} from "./plugins/syntaxPlugins/boldSyntaxRenderer";
export {
  createCodeBlockHighlightExtension,
} from "./plugins/syntaxPlugins/codeBlockHighlightExtension";
export {
  registerCodeBlockSyntaxRenderer,
} from "./plugins/syntaxPlugins/codeBlockSyntaxRenderer";
export {
  createFrontmatterSyntaxExtension,
  estimateFrontmatterWidgetHeight,
  isFrontmatterBlockSelected,
  parseFrontmatterBlock,
  shouldKeepFrontmatterSourceVisible,
} from "./plugins/syntaxPlugins/frontmatterSyntaxExtension";
export {
  applyHeaderLineDecorations,
  registerHeaderSyntaxRenderer,
} from "./plugins/syntaxPlugins/headerSyntaxRenderer";
export {
  registerHighlightSyntaxRenderer,
} from "./plugins/syntaxPlugins/highlightSyntaxRenderer";
export {
  registerHorizontalRuleSyntaxRenderer,
} from "./plugins/syntaxPlugins/horizontalRuleSyntaxRenderer";
export {
  createImageEmbedSyntaxExtension,
} from "./plugins/syntaxPlugins/imageEmbedSyntaxExtension";
export type {
  ImageEmbedSyntaxExtensionOptions,
} from "./plugins/syntaxPlugins/imageEmbedSyntaxExtension";
export {
  shouldRebuildImageEmbedDecorations,
} from "./plugins/syntaxPlugins/imageEmbedUpdatePolicy";
export {
  registerInlineCodeSyntaxRenderer,
} from "./plugins/syntaxPlugins/inlineCodeSyntaxRenderer";
export {
  registerItalicSyntaxRenderer,
} from "./plugins/syntaxPlugins/italicSyntaxRenderer";
export {
  createLatexSyntaxExtension,
  estimateBlockLatexWidgetHeight,
  resolveLatexBlockWidgetPlacement,
  resolveLatexPriorityExclusionRanges,
} from "./plugins/syntaxPlugins/latexSyntaxExtension";
export {
  registerLinkSyntaxRenderer,
} from "./plugins/syntaxPlugins/linkSyntaxRenderer";
export {
  applyListLineDecorations,
  buildTaskCheckboxToggleSpec,
  createTaskCheckboxToggleExtension,
  detectMarkdownListLine,
  registerListSyntaxRenderer,
  toggleTaskCheckboxAtPosition,
} from "./plugins/syntaxPlugins/listSyntaxRenderer";
export type {
  MarkdownListKind,
  MarkdownListLineMatch,
  MarkdownTaskState,
  TaskCheckboxToggleSpec,
} from "./plugins/syntaxPlugins/listSyntaxRenderer";
export {
  createMarkdownTableSyntaxExtension,
  estimateMarkdownTableWidgetHeight as estimateMarkdownTableSyntaxWidgetHeight,
  shouldKeepMarkdownTableSourceVisible,
} from "./plugins/syntaxPlugins/markdownTableSyntaxExtension";
export {
  isMermaidLanguage,
  renderMermaidToElement,
} from "./plugins/syntaxPlugins/mermaidRenderer";
export {
  registerStrikethroughSyntaxRenderer,
} from "./plugins/syntaxPlugins/strikethroughSyntaxRenderer";
export {
  registerTagSyntaxRenderer,
} from "./plugins/syntaxPlugins/tagSyntaxRenderer";
export {
  createWikiLinkNavigationExtension,
  extractWidgetWikiLinkTarget,
  findWikiLinkAtPosition,
  handleWikiLinkMouseDown,
  isRenderedWikiLinkTarget,
  openWikiLinkTarget,
  registerWikiLinkSyntaxRenderer,
} from "./plugins/syntaxPlugins/wikiLinkSyntaxRenderer";
export type {
  WikiLinkMatch,
  WikiLinkMouseDownEventLike,
  WikiLinkMouseDownViewLike,
  WikiLinkNavigationOptions,
} from "./plugins/syntaxPlugins/wikiLinkSyntaxRenderer";
export {
  createWikiLinkPreviewExtension,
  isWikiLinkPreviewModifierPressed,
  resolveWikiLinkPreviewAtMouseEvent,
} from "./plugins/syntaxPlugins/wikiLinkPreviewExtension";
export type {
  WikiLinkPreviewExtensionOptions,
  WikiLinkPreviewModifierState,
  WikiLinkPreviewMouseEventLike,
  WikiLinkPreviewTarget,
  WikiLinkPreviewViewLike,
} from "./plugins/syntaxPlugins/wikiLinkPreviewExtension";
export {
  createBlockAtomicRangesExtension,
  hiddenBlockAnchorLineDecoration,
  hiddenBlockLineDecoration,
  rangeTouchesBlock,
} from "./plugins/syntaxPlugins/blockWidgetReplace";
export type {
  BlockRange,
  BlockSelectionRange,
} from "./plugins/syntaxPlugins/blockWidgetReplace";
export {
  MarkdownTableVisualEditor,
} from "./plugins/components/MarkdownTableVisualEditor";
export type {
  MarkdownTableVisualEditorProps,
} from "./plugins/components/MarkdownTableVisualEditor";
export {
  FrontmatterYamlVisualEditor,
  GOVERNED_FRONTMATTER_FIELDS,
  buildDefaultValueByFieldType,
  convertValueToFieldType,
  getFrontmatterFieldSuggestions,
  getGovernedFrontmatterField,
  resolveNextFieldKey,
} from "./plugins/components/FrontmatterYamlVisualEditor";
export type {
  FrontmatterFieldType,
  FrontmatterYamlVisualEditorProps,
  GovernedFrontmatterField,
  GovernedFrontmatterFieldUsage,
} from "./plugins/components/FrontmatterYamlVisualEditor";
export {
  TableCellLatex,
} from "./plugins/components/MarkdownTableCellLatex";
export {
  clearFocusedMarkdownTableEditor,
  flushFocusedMarkdownTableEditor,
  isMarkdownTableEditorFocused,
  setFocusedMarkdownTableEditor,
} from "./plugins/markdownTableWidgetRegistry";
export type {
  FocusedMarkdownTableEditor,
} from "./plugins/markdownTableWidgetRegistry";
export {
  createWikiLinkPreviewId,
  hasWikiLinkPreviewDescendant,
  registerWikiLinkPreview,
  subscribeWikiLinkPreviewHierarchy,
  unregisterWikiLinkPreview,
  WikiLinkPreviewParentContext,
} from "./plugins/wikiLinkPreviewHierarchy";
export {
  createImeCompositionGuard,
  isImeComposing,
  shouldAllowBlurActionAfterComposition,
  shouldDeferBlurCommitAfterComposition,
  shouldSubmitPlainEnter,
} from "./utils/imeInputGuard";
export type {
  ImeCompositionGuard,
  ImeCompositionStateSnapshot,
} from "./utils/imeInputGuard";
export {
  UiNumberInput,
} from "./ui";
export type {
  UiNumberInputCommitReason,
  UiNumberInputProps,
} from "./ui";
export {
  ensureBuiltinVimHandoffsRegistered,
} from "./plugins/handoff/registerBuiltinVimHandoffs";
export {
  applyResolvedVimHandoff,
  createVimImeInputPriorityExtension,
  handleEditorBodyVimHandoffTextInput,
  handleVimImeKeydown,
  handleVimImeTextInput,
  isVimNormalMode,
  resolvePlainTextVimKeydownKey,
  resolveEditorBodyVimHandoff,
} from "./plugins/handoff/vimImeInputPriorityExtension";
export type {
  CodeMirrorLike,
  HandleVimImeKeydownOptions,
  ResolveEditorBodyVimHandoffDependencies,
  ResolveEditorBodyVimHandoffOptions,
  VimImeInputPriorityDependencies,
  VimImeKeydownEventLike,
  VimStateLike,
} from "./plugins/handoff/vimImeInputPriorityExtension";
export {
  registerFrontmatterBodyVimHandoff,
} from "./plugins/handoff/builtins/frontmatterBodyVimHandoff";
export {
  registerLatexBlockVimHandoff,
} from "./plugins/handoff/builtins/latexBlockVimHandoff";
export {
  registerMarkdownTableBodyVimHandoff,
} from "./plugins/handoff/builtins/markdownTableBodyVimHandoff";
export {
  registerMermaidBlockVimHandoff,
} from "./plugins/handoff/builtins/mermaidBlockVimHandoff";
export {
  listRegisteredVimHandoffs,
  registerVimHandoff,
  resolveRegisteredVimHandoff,
  unregisterVimHandoff,
  VIM_HANDOFF_PRIORITY,
} from "./plugins/handoff/vimHandoffRegistry";
export type {
  VimHandoffContext,
  VimHandoffRegistration,
  VimHandoffResult,
  VimHandoffSurface,
  VimHandoffWidget,
  VimHandoffWidgetPosition,
} from "./plugins/handoff/vimHandoffRegistry";
export {
  isPlainFrontmatterVimKey,
  resolveFrontmatterEnterAction,
  resolveFrontmatterNavigationMove,
  shouldEnterFrontmatterFromBody,
} from "./plugins/handoff/frontmatterVimHandoff";
export type {
  EnterFrontmatterFromBodyOptions,
  FrontmatterEnterAction,
  FrontmatterNavigationMoveResult,
  PlainFrontmatterVimKeyEvent,
} from "./plugins/handoff/frontmatterVimHandoff";
export {
  resolveLatexVimHandoffLine,
} from "./plugins/handoff/latexVimHandoff";
export type {
  ResolveLatexVimHandoffLineOptions,
} from "./plugins/handoff/latexVimHandoff";
export {
  resolveMermaidVimHandoffLine,
} from "./plugins/handoff/mermaidVimHandoff";
export type {
  ResolveMermaidVimHandoffLineOptions,
} from "./plugins/handoff/mermaidVimHandoff";
