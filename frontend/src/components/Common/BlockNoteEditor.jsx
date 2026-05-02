import clsx from "clsx";
import { Check, GripVertical } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { blocksToPlainText, createNoteBlock, normalizeNoteBlocks } from "../../utils/noteBlocks";

const BLOCK_TYPES = {
  paragraph: { label: "Text", className: "text-[15px] font-medium leading-7 text-[#E4E7EB]" },
  h1: { label: "Heading 1", className: "text-[26px] font-bold leading-9 text-[#F7F7F8]" },
  h2: { label: "Heading 2", className: "text-[21px] font-bold leading-8 text-[#F7F7F8]" },
  h3: { label: "Heading 3", className: "text-[17px] font-bold leading-7 text-[#F7F7F8]" },
  bullet: { label: "Bulleted list", className: "text-[15px] font-medium leading-7 text-[#E4E7EB]" },
  numbered: { label: "Numbered list", className: "text-[15px] font-medium leading-7 text-[#E4E7EB]" },
  todo: { label: "Todo list", className: "text-[15px] font-medium leading-7 text-[#E4E7EB]" },
  quote: { label: "Quote", className: "text-[15px] font-semibold italic leading-7 text-[#C4CAD3]" },
  code: { label: "Code", className: "font-mono text-[13px] leading-6 text-[#D4D4D8]" }
};

const LIST_TYPES = new Set(["bullet", "numbered", "todo"]);
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

const COMMANDS = [
  { type: "paragraph", label: "テキスト", hint: "通常の本文ブロック" },
  { type: "h1", label: "見出し 1", hint: "# 大きい見出し" },
  { type: "h2", label: "見出し 2", hint: "## 中くらいの見出し" },
  { type: "h3", label: "見出し 3", hint: "### 小さい見出し" },
  { type: "bullet", label: "箇条書き", hint: "- リスト項目" },
  { type: "numbered", label: "番号付きリスト", hint: "1. 連番リスト" },
  { type: "todo", label: "チェックリスト", hint: "[] 完了チェック付き" },
  { type: "quote", label: "引用", hint: "> 引用文" },
  { type: "code", label: "コード", hint: "``` コードブロック" }
];

const COMMAND_ALIASES = {
  paragraph: ["text"],
  h1: ["h1", "heading"],
  h2: ["h2", "heading"],
  h3: ["h3", "heading"],
  bullet: ["bullet", "list"],
  numbered: ["number", "numbered", "ordered", "list"],
  todo: ["todo", "check", "checkbox", "task"],
  quote: ["quote"],
  code: ["code"]
};

export default function BlockNoteEditor({ blocks, onChange }) {
  const editorRef = useRef(null);
  const blockRefs = useRef({});
  const linkChoiceRef = useRef(null);
  const draggingBlockIdRef = useRef(null);
  const markdownConvertedBlockIdsRef = useRef(new Set());
  const pendingCaretRef = useRef(null);
  const [slashState, setSlashState] = useState(null);
  const [slashMenuLayout, setSlashMenuLayout] = useState({ blockId: null, direction: "down", maxHeight: 274 });
  const [dragOverId, setDragOverId] = useState(null);
  const [focusedBlockId, setFocusedBlockId] = useState(null);
  const [linkChoice, setLinkChoice] = useState(null);
  const safeBlocks = useMemo(() => normalizeNoteBlocks(blocks), [blocks]);

  useLayoutEffect(() => {
    if (!slashState?.blockId) return;

    const frame = requestAnimationFrame(() => {
      const input = blockRefs.current[slashState.blockId];
      if (!input) return;

      const rect = input.getBoundingClientRect();
      const menuHeight = 274;
      const bottomSpace = window.innerHeight - rect.bottom - 18;
      const topSpace = rect.top - 18;
      const direction = bottomSpace < menuHeight && topSpace > bottomSpace ? "up" : "down";
      const availableHeight = direction === "up" ? topSpace : bottomSpace;

      setSlashMenuLayout({
        blockId: slashState.blockId,
        direction,
        maxHeight: Math.max(160, Math.min(menuHeight, availableHeight))
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [slashState, safeBlocks]);

  useEffect(() => {
    if (!linkChoice) return;

    const handlePointerDown = (event) => {
      if (linkChoiceRef.current?.contains(event.target)) return;
      setLinkChoice(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setLinkChoice(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [linkChoice]);

  const commit = (nextBlocks) => {
    const normalized = normalizeNoteBlocks(nextBlocks);
    onChange(normalized, blocksToPlainText(normalized));
  };

  const syncDomText = (blockId, text) => {
    const input = blockRefs.current[blockId];
    if (input && input.textContent !== text) {
      input.textContent = text;
    }
  };

  function getEditableText(element) {
    return element?.textContent || "";
  }

  const normalizeUrl = (url) => (url.startsWith("www.") ? `https://${url}` : url);
  const hasUrl = (text = "") => /(?:https?:\/\/|www\.)[^\s<>"']+/i.test(text);
  const findFirstUrl = (text = "") => {
    const match = text.match(/(?:https?:\/\/|www\.)[^\s<>"']+/i);
    return match ? { text: match[0], index: match.index ?? 0 } : null;
  };

  const getMentionLabel = (url) => {
    try {
      const parsed = new URL(normalizeUrl(url));
      const hostname = parsed.hostname.replace(/^www\./, "");
      return `@${hostname || url}`;
    } catch {
      return `@${url.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0] || "link"}`;
    }
  };

  const renderUrlSegments = (text, keyPrefix = "url") => {
    if (!text) return null;

    const segments = [];
    let lastIndex = 0;

    for (const match of text.matchAll(URL_PATTERN)) {
      const urlText = match[0];
      const start = match.index ?? 0;
      if (start > lastIndex) segments.push(text.slice(lastIndex, start));

      const trailingPunctuationMatch = urlText.match(/[.,;:!?)]$/);
      const linkText = trailingPunctuationMatch ? urlText.slice(0, -1) : urlText;
      const trailing = trailingPunctuationMatch ? trailingPunctuationMatch[0] : "";

      segments.push(
        <a
          key={`${keyPrefix}-${start}-${linkText}`}
          href={normalizeUrl(linkText)}
          contentEditable={false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            window.open(normalizeUrl(linkText), "_blank", "noopener,noreferrer");
          }}
          className="font-semibold text-[#8FCAFF] underline decoration-[#8FCAFF]/45 underline-offset-4 transition-colors hover:text-[#B7DDFF] hover:decoration-[#B7DDFF]"
        >
          {linkText}
        </a>
      );
      if (trailing) segments.push(trailing);
      lastIndex = start + urlText.length;
    }

    if (lastIndex < text.length) segments.push(text.slice(lastIndex));
    return segments;
  };

  const renderLinkedText = (block) => {
    const text = block.text || "";
    const mentions = (block.mentions || [])
      .filter((mention) => mention.url && text.slice(mention.start, mention.end) === mention.label)
      .sort((left, right) => left.start - right.start);

    if (mentions.length === 0) return renderUrlSegments(text);

    const segments = [];
    let cursor = 0;

    mentions.forEach((mention, index) => {
      if (mention.start > cursor) {
        const prefixSegments = renderUrlSegments(text.slice(cursor, mention.start), `pre-${mention.id || index}`);
        if (prefixSegments) segments.push(...prefixSegments);
      }

      segments.push(
        <a
          key={mention.id || `${mention.start}-${mention.end}`}
          href={normalizeUrl(mention.url)}
          contentEditable={false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            window.open(normalizeUrl(mention.url), "_blank", "noopener,noreferrer");
          }}
          className="inline-flex max-w-full items-center rounded-full border border-[#60B964]/25 bg-[#1F3423] px-2 py-0.5 text-sm font-bold text-[#8FE08F] no-underline transition-colors hover:border-[#60B964]/55 hover:bg-[#24452A]"
        >
          {mention.label}
        </a>
      );
      cursor = mention.end;
    });

    if (cursor < text.length) {
      const suffixSegments = renderUrlSegments(text.slice(cursor), "post");
      if (suffixSegments) segments.push(...suffixSegments);
    }

    return segments;
  };

  function getCaretOffset(element) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return getEditableText(element).length;

    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer)) return getEditableText(element).length;

    const clonedRange = range.cloneRange();
    clonedRange.selectNodeContents(element);
    clonedRange.setEnd(range.startContainer, range.startOffset);
    return clonedRange.toString().length;
  }

  function setCaretOffset(element, offset) {
    const selection = window.getSelection();
    if (!selection) return;

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, offset);
    let currentNode = walker.nextNode();

    while (currentNode) {
      const length = currentNode.textContent.length;
      if (remaining <= length) {
        const range = document.createRange();
        range.setStart(currentNode, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= length;
      currentNode = walker.nextNode();
    }

    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  useLayoutEffect(() => {
    const pendingCaret = pendingCaretRef.current;
    if (!pendingCaret) return;

    const input = blockRefs.current[pendingCaret.blockId];
    if (!input) return;

    const block = safeBlocks.find((item) => item.id === pendingCaret.blockId);
    if (block && input.textContent !== block.text) {
      input.textContent = block.text;
    }

    pendingCaretRef.current = null;
    input.focus({ preventScroll: true });
    setCaretOffset(input, Math.min(pendingCaret.offset, getEditableText(input).length));
  }, [safeBlocks]);

  const getBlockElementFromNode = (node) => {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return element?.closest?.("[data-note-block-id]") || null;
  };

  const getActiveBlockContext = () => {
    const selection = window.getSelection();
    const blockElement = getBlockElementFromNode(selection?.anchorNode);
    if (!blockElement) return null;

    const blockId = blockElement.dataset.noteBlockId;
    const index = safeBlocks.findIndex((block) => block.id === blockId);
    if (index < 0) return null;

    return {
      block: safeBlocks[index],
      blockElement,
      index
    };
  };

  const getOffsetWithinBlock = (blockElement, node, offset) => {
    if (!blockElement || !node || !blockElement.contains(node)) return 0;

    const range = document.createRange();
    range.selectNodeContents(blockElement);
    range.setEnd(node, offset);
    return range.toString().length;
  };

  const getSelectedBlockRanges = (range) =>
    safeBlocks
      .map((block, index) => {
        const blockElement = blockRefs.current[block.id];
        if (!blockElement || !range.intersectsNode(blockElement)) return null;

        const textLength = getEditableText(blockElement).length;
        const startOffset = blockElement.contains(range.startContainer)
          ? getOffsetWithinBlock(blockElement, range.startContainer, range.startOffset)
          : 0;
        const endOffset = blockElement.contains(range.endContainer)
          ? getOffsetWithinBlock(blockElement, range.endContainer, range.endOffset)
          : textLength;

        if (startOffset === endOffset) return null;
        return { block, index, startOffset, endOffset };
      })
      .filter(Boolean);

  const deleteSelectedText = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

    const selectedRanges = getSelectedBlockRanges(selection.getRangeAt(0));
    if (selectedRanges.length === 0) return false;

    if (selectedRanges.length === 1) {
      const [{ block: startBlock, startOffset, endOffset }] = selectedRanges;
      const nextText = `${startBlock.text.slice(0, startOffset)}${startBlock.text.slice(endOffset)}`;
      pendingCaretRef.current = { blockId: startBlock.id, offset: startOffset };
      commit(safeBlocks.map((block) => (block.id === startBlock.id ? { ...block, text: nextText } : block)));
      selection.removeAllRanges();
      return true;
    }

    const firstSelection = selectedRanges[0];
    const lastSelection = selectedRanges.at(-1);
    const startIndex = firstSelection.index;
    const endIndex = lastSelection.index;
    const startOffset = firstSelection.startOffset;
    const endOffset = lastSelection.endOffset;
    const startBlock = firstSelection.block;
    const endBlock = lastSelection.block;
    const mergedText = `${startBlock.text.slice(0, startOffset)}${endBlock.text.slice(endOffset)}`;
    const deletesEverything =
      startIndex === 0 &&
      endIndex === safeBlocks.length - 1 &&
      startOffset === 0 &&
      endOffset === endBlock.text.length;

    const replacementBlock = deletesEverything ? createNoteBlock() : { ...startBlock, text: mergedText };
    const nextBlocks = [...safeBlocks.slice(0, startIndex), replacementBlock, ...safeBlocks.slice(endIndex + 1)];
    pendingCaretRef.current = { blockId: replacementBlock.id, offset: deletesEverything ? 0 : startOffset };
    commit(nextBlocks);
    selection.removeAllRanges();
    return true;
  };

  const focusBlock = (blockId, cursor = "end") => {
    requestAnimationFrame(() => {
      const input = blockRefs.current[blockId];
      if (!input) return;

      input.focus({ preventScroll: true });
      const position = cursor === "start" ? 0 : cursor === "end" ? getEditableText(input).length : cursor;
      setCaretOffset(input, position);
    });
  };

  const updateBlock = (blockId, patch) => {
    commit(safeBlocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  };

  const convertBlock = (blockId, type, text = null) => {
    const nextBlocks = safeBlocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            type,
            text: text ?? (block.text.startsWith("/") ? "" : block.text.replace(/^\/\w*\s?/, "")),
            checked: type === "todo" ? block.checked : false,
            indent: LIST_TYPES.has(type) ? block.indent : 0
          }
        : block
    );
    commit(nextBlocks);
    setSlashState(null);
    focusBlock(blockId);
  };

  const applyMarkdownShortcut = (block, value) => {
    const shortcuts = [
      { marker: "# ", type: "h1" },
      { marker: "## ", type: "h2" },
      { marker: "### ", type: "h3" },
      { marker: "- ", type: "bullet" },
      { marker: "* ", type: "bullet" },
      { marker: "1. ", type: "numbered" },
      { marker: "[] ", type: "todo" },
      { marker: "> ", type: "quote" },
      { marker: "``` ", type: "code" }
    ].sort((left, right) => right.marker.length - left.marker.length);

    const match = shortcuts.find((shortcut) => value.startsWith(shortcut.marker));
    if (!match) return false;

    convertBlock(block.id, match.type, value.slice(match.marker.length));
    markdownConvertedBlockIdsRef.current.add(block.id);
    return true;
  };

  const handleEnter = (event, block, index) => {
    if (event.shiftKey) return;
    event.preventDefault();
    const cursor = getCaretOffset(blockRefs.current[block.id]);

    const leadingBulletMarker = block.text.match(/^\u30fb\s?/);
    if (block.type === "paragraph" && leadingBulletMarker && cursor === leadingBulletMarker[0].length) {
      markdownConvertedBlockIdsRef.current.add(block.id);
      pendingCaretRef.current = { blockId: block.id, offset: 0 };
      commit(
        safeBlocks.map((item) =>
          item.id === block.id
            ? {
                ...item,
                type: "bullet",
                text: item.text.replace(/^\u30fb\s?/, ""),
                indent: 0,
                checked: false
              }
            : item
        )
      );
      return;
    }

    if (!block.text && block.type !== "paragraph") {
      updateBlock(block.id, { type: "paragraph", indent: 0, checked: false });
      return;
    }

    const before = block.text.slice(0, cursor);
    const after = block.text.slice(cursor);
    const shouldContinueBlockType = LIST_TYPES.has(block.type);
    const newBlock = createNoteBlock({
      type: shouldContinueBlockType ? block.type : "paragraph",
      text: after,
      checked: false,
      indent: shouldContinueBlockType ? block.indent : 0
    });
    const nextBlocks = [...safeBlocks];
    nextBlocks.splice(index, 1, { ...block, text: before }, newBlock);
    commit(nextBlocks);
    focusBlock(newBlock.id, "start");
  };

  const handleBackspace = (event, block, index) => {
    const cursor = getCaretOffset(blockRefs.current[block.id]);
    if (cursor !== 0) return;

    if (block.type !== "paragraph" && !block.text && markdownConvertedBlockIdsRef.current.has(block.id)) {
      event.preventDefault();
      markdownConvertedBlockIdsRef.current.delete(block.id);

      if (safeBlocks.length === 1) {
        const emptyBlock = createNoteBlock();
        commit([emptyBlock]);
        focusBlock(emptyBlock.id, "start");
        return;
      }

      const nextFocusBlock = safeBlocks[index - 1] || safeBlocks[index + 1];
      commit(safeBlocks.filter((item) => item.id !== block.id));
      focusBlock(nextFocusBlock.id, index > 0 ? "end" : "start");
      return;
    }

    if (block.type !== "paragraph") {
      event.preventDefault();
      markdownConvertedBlockIdsRef.current.delete(block.id);
      updateBlock(block.id, { type: "paragraph", indent: 0, checked: false });
      return;
    }

    if (index === 0) return;
    event.preventDefault();

    const previous = safeBlocks[index - 1];
    const mergedText = `${previous.text || ""}${block.text || ""}`;
    const nextBlocks = safeBlocks.filter((item) => item.id !== block.id).map((item) => (item.id === previous.id ? { ...item, text: mergedText } : item));
    commit(nextBlocks);
    focusBlock(previous.id, previous.text.length);
  };

  const handleDelete = (event, block, index) => {
    const cursor = getCaretOffset(blockRefs.current[block.id]);
    if (cursor !== block.text.length || index >= safeBlocks.length - 1) return;

    event.preventDefault();
    const next = safeBlocks[index + 1];
    const mergedText = `${block.text || ""}${next.text || ""}`;
    const nextBlocks = safeBlocks.filter((item) => item.id !== next.id).map((item) => (item.id === block.id ? { ...item, text: mergedText } : item));
    commit(nextBlocks);
    focusBlock(block.id, block.text.length);
  };

  const handleArrowNavigation = (event, block, index) => {
    const cursor = getCaretOffset(blockRefs.current[block.id]);
    if ((event.key === "ArrowLeft" || event.key === "ArrowUp") && cursor === 0 && index > 0) {
      event.preventDefault();
      focusBlock(safeBlocks[index - 1].id, "end");
    }
    if ((event.key === "ArrowRight" || event.key === "ArrowDown") && cursor === block.text.length && index < safeBlocks.length - 1) {
      event.preventDefault();
      focusBlock(safeBlocks[index + 1].id, "start");
    }
  };

  const handlePaste = (event, block, index) => {
    const pasted = event.clipboardData.getData("text/plain");
    if (!pasted.includes("\n") && hasUrl(pasted)) {
      event.preventDefault();
      const blockElement = blockRefs.current[block.id];
      const cursor = getCaretOffset(blockElement);
      const pastedUrl = findFirstUrl(pasted)?.text || pasted;
      const urlStart = cursor + (findFirstUrl(pasted)?.index || 0);
      const urlEnd = urlStart + pastedUrl.length;
      const rect = blockElement?.getBoundingClientRect();
      const nextText = `${block.text.slice(0, cursor)}${pasted}${block.text.slice(cursor)}`;
      pendingCaretRef.current = { blockId: block.id, offset: cursor + pasted.length };
      commit(safeBlocks.map((item) => (item.id === block.id ? { ...item, text: nextText } : item)));
      if (rect) {
        setLinkChoice({
          blockId: block.id,
          start: urlStart,
          end: urlEnd,
          url: pastedUrl,
          top: Math.min(window.innerHeight - 132, rect.bottom + 8),
          left: Math.min(window.innerWidth - 272, Math.max(16, rect.left + 32))
        });
      }
      return;
    }

    if (!pasted.includes("\n")) return;

    event.preventDefault();
    const cursor = getCaretOffset(blockRefs.current[block.id]);
    const lines = pasted.replace(/\r\n/g, "\n").split("\n");
    const firstText = `${block.text.slice(0, cursor)}${lines[0]}`;
    const lastText = `${lines.at(-1)}${block.text.slice(cursor)}`;
    const inserted = lines.slice(1, -1).map((line) => createNoteBlock({ text: line }));
    const newBlocks = [
      { ...block, text: firstText },
      ...inserted,
      createNoteBlock({ text: lastText })
    ];
    const nextBlocks = [...safeBlocks];
    nextBlocks.splice(index, 1, ...newBlocks);
    commit(nextBlocks);
    focusBlock(newBlocks.at(-1).id, lines.at(-1).length);
  };

  const handleKeyDown = (event) => {
    if ((event.key === "Backspace" || event.key === "Delete") && deleteSelectedText()) {
      event.preventDefault();
      return;
    }

    const activeContext = getActiveBlockContext();
    if (!activeContext) return;

    const { block, index } = activeContext;

    if (slashState?.blockId === block.id && ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) {
      const filtered = getFilteredCommands();
      if (event.key === "Escape") {
        event.preventDefault();
        setSlashState(null);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setSlashState((current) => ({
          ...current,
          selectedIndex:
            event.key === "ArrowDown"
              ? Math.min(filtered.length - 1, current.selectedIndex + 1)
              : Math.max(0, current.selectedIndex - 1)
        }));
        return;
      }
      if (event.key === "Enter" && filtered[slashState.selectedIndex]) {
        event.preventDefault();
        convertBlock(block.id, filtered[slashState.selectedIndex].type, "");
        return;
      }
    }

    if (event.key === "Enter") handleEnter(event, block, index);
    if (event.key === "Backspace") handleBackspace(event, block, index);
    if (event.key === "Delete") handleDelete(event, block, index);
    if (event.key === "Tab" && LIST_TYPES.has(block.type)) {
      event.preventDefault();
      updateBlock(block.id, { indent: Math.max(0, Math.min(4, block.indent + (event.shiftKey ? -1 : 1))) });
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) handleArrowNavigation(event, block, index);
  };

  const handleEditorInput = () => {
    const activeContext = getActiveBlockContext();
    const nextBlocks = safeBlocks.map((block) => ({
      ...block,
      text: getEditableText(blockRefs.current[block.id])
    }));
    const activeBlock = activeContext ? nextBlocks.find((block) => block.id === activeContext.block.id) : null;

    if (activeBlock && applyMarkdownShortcut(activeBlock, activeBlock.text)) return;

    if (activeContext) {
      pendingCaretRef.current = {
        blockId: activeContext.block.id,
        offset: getCaretOffset(activeContext.blockElement)
      };
    }

    commit(nextBlocks);

    if (activeBlock?.text.startsWith("/")) {
      setSlashState({ blockId: activeBlock.id, query: activeBlock.text.slice(1).trim().toLowerCase(), selectedIndex: 0 });
    } else if (slashState?.blockId === activeBlock?.id) {
      setSlashState(null);
    }
  };

  const getFilteredCommands = () => {
    if (!slashState) return [];
    return COMMANDS.filter((command) =>
      `${command.label} ${command.hint} ${(COMMAND_ALIASES[command.type] || []).join(" ")}`.toLowerCase().includes(slashState.query)
    );
  };

  const moveBlock = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const fromIndex = safeBlocks.findIndex((block) => block.id === fromId);
    const toIndex = safeBlocks.findIndex((block) => block.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextBlocks = [...safeBlocks];
    const [moved] = nextBlocks.splice(fromIndex, 1);
    nextBlocks.splice(toIndex, 0, moved);
    commit(nextBlocks);
  };

  const applyLinkChoiceAsMention = () => {
    if (!linkChoice) return;

    const label = getMentionLabel(linkChoice.url);
    const nextBlocks = safeBlocks.map((block) => {
      if (block.id !== linkChoice.blockId) return block;

      const nextText = `${block.text.slice(0, linkChoice.start)}${label}${block.text.slice(linkChoice.end)}`;
      const nextMention = {
        id: globalThis.crypto?.randomUUID?.() || `mention_${Date.now()}`,
        start: linkChoice.start,
        end: linkChoice.start + label.length,
        label,
        url: normalizeUrl(linkChoice.url)
      };

      return {
        ...block,
        text: nextText,
        mentions: [...(block.mentions || []), nextMention]
      };
    });

    pendingCaretRef.current = { blockId: linkChoice.blockId, offset: linkChoice.start + label.length };
    commit(nextBlocks);
    requestAnimationFrame(() => blockRefs.current[linkChoice.blockId]?.blur());
    setLinkChoice(null);
  };

  const applyLinkChoiceAsLink = () => {
    if (!linkChoice) return;
    requestAnimationFrame(() => blockRefs.current[linkChoice.blockId]?.blur());
    setLinkChoice(null);
  };

  const filteredCommands = getFilteredCommands();

  const linkChoicePopup = linkChoice
    ? createPortal(
        <div
          ref={linkChoiceRef}
          className="fixed z-[90] w-64 rounded-2xl border border-[#20242A] bg-[#111418] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
          style={{ top: `${linkChoice.top}px`, left: `${linkChoice.left}px` }}
          contentEditable={false}
        >
          <div className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#78D27F]">Pasted link</div>
          <button
            type="button"
            onClick={applyLinkChoiceAsLink}
            className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-[#25272F]"
          >
            <span className="text-sm font-bold text-[#F4F4F5]">リンクにする</span>
            <span className="mt-0.5 truncate text-xs font-semibold text-[#8B949E]">{linkChoice.url}</span>
          </button>
          <button
            type="button"
            onClick={applyLinkChoiceAsMention}
            className="mt-1 flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-[#1F3423]"
          >
            <span className="text-sm font-bold text-[#F4F4F5]">メンションにする</span>
            <span className="mt-0.5 truncate text-xs font-semibold text-[#78D27F]">{getMentionLabel(linkChoice.url)}</span>
          </button>
        </div>,
        document.body
      )
    : null;

  const getNumberedListLabel = (index) => {
    const counters = [];
    let clusterStart = index;

    while (clusterStart > 0 && safeBlocks[clusterStart - 1].type === "numbered") {
      clusterStart -= 1;
    }

    for (let currentIndex = clusterStart; currentIndex <= index; currentIndex += 1) {
      const currentBlock = safeBlocks[currentIndex];
      const indent = Math.max(0, Math.min(4, Number(currentBlock.indent) || 0));

      for (let depth = 0; depth <= indent; depth += 1) {
        if (!counters[depth]) counters[depth] = 0;
      }

      counters[indent] += 1;
      counters.length = indent + 1;
    }

    return counters.join(".");
  };

  const getBulletMarkerClassName = (indent) => {
    const depth = Math.max(0, indent) % 4;
    if (depth === 1) return "h-1.5 w-1.5 rounded-full border-[1.5px] border-[#AAB4C2]";
    if (depth === 2) return "h-1.5 w-1.5 rounded-[2px] bg-[#AAB4C2]";
    if (depth === 3) return "h-1.5 w-1.5 rounded-full bg-[#AAB4C2]";
    return "h-2 w-2 rounded-full bg-[#AAB4C2]";
  };

  return (
    <>
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleEditorInput}
      onKeyDown={handleKeyDown}
      onPaste={(event) => {
        const activeContext = getActiveBlockContext();
        if (activeContext) handlePaste(event, activeContext.block, activeContext.index);
      }}
      onFocus={() => {
        const activeContext = getActiveBlockContext();
        if (activeContext) setFocusedBlockId(activeContext.block.id);
      }}
      onBlur={() => setFocusedBlockId(null)}
      onPointerUp={() => {
        const activeContext = getActiveBlockContext();
        setFocusedBlockId(activeContext?.block.id || null);
      }}
      className="mt-7 min-h-[420px] min-w-0 space-y-1 overflow-x-hidden outline-none"
    >
      {safeBlocks.map((block, index) => {
        const type = BLOCK_TYPES[block.type] || BLOCK_TYPES.paragraph;
        const isSlashOpen = slashState?.blockId === block.id && filteredCommands.length > 0;

        return (
          <div
            key={block.id}
            className={clsx(
              "group relative flex items-start rounded-lg transition-colors",
              LIST_TYPES.has(block.type) ? "py-0.5" : "py-1",
              dragOverId === block.id && "ring-1 ring-[#60B964]/60"
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverId(block.id);
            }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(event) => {
              event.preventDefault();
              moveBlock(draggingBlockIdRef.current, block.id);
              draggingBlockIdRef.current = null;
              setDragOverId(null);
            }}
          >
            <button
              type="button"
              data-block-action="true"
              contentEditable={false}
              draggable
              onDragStart={(event) => {
                draggingBlockIdRef.current = block.id;
                event.dataTransfer.effectAllowed = "move";
              }}
              className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#66717F] opacity-0 transition-opacity hover:bg-[#34363D] hover:text-[#E4E7EB] group-hover:opacity-100"
              title="Move block"
            >
              <GripVertical className="h-4 w-4" />
            </button>

            <div className="flex min-w-0 flex-1 items-start gap-2" style={{ paddingLeft: `${block.indent * 28}px` }}>
              {block.type === "bullet" ? (
                <span contentEditable={false} className="mt-[9px] flex h-4 w-8 shrink-0 items-center justify-center">
                  <span className={getBulletMarkerClassName(block.indent)} />
                </span>
              ) : null}
              {block.type === "numbered" ? (
                <span contentEditable={false} className="mt-[4px] flex h-7 w-8 shrink-0 items-center justify-start text-[16px] font-semibold leading-7 text-[#AAB4C2]">
                  {getNumberedListLabel(index)}.
                </span>
              ) : null}
              {block.type === "todo" ? (
                <span contentEditable={false} className="mt-[8px] flex h-4 w-8 shrink-0 items-center justify-center">
                  <button
                    type="button"
                    onClick={() => updateBlock(block.id, { checked: !block.checked })}
                    className="flex h-3.5 w-3.5 items-center justify-center rounded border border-[#52525B] text-[#06100D]"
                    style={block.checked ? { backgroundColor: "#60B964", borderColor: "#60B964" } : undefined}
                  >
                    {block.checked ? <Check className="h-2.5 w-2.5" /> : null}
                  </button>
                </span>
              ) : null}
              {block.type === "quote" ? <span contentEditable={false} className="mt-1 h-7 w-1 shrink-0 rounded-full bg-[#34363D]" /> : null}

              <div
                ref={(input) => {
                  if (!input) return;
                  blockRefs.current[block.id] = input;
                  if (focusedBlockId === block.id) syncDomText(block.id, block.text);
                }}
                data-note-block-id={block.id}
                data-placeholder={index === 0 ? "\u30e1\u30e2\u3092\u66f8\u304f... / \u3067\u30d6\u30ed\u30c3\u30af" : ""}
                className={clsx(
                  "min-w-0 flex-1 whitespace-pre-wrap break-words border-0 bg-transparent px-0 outline-none [overflow-wrap:anywhere] [word-break:break-word] empty:before:text-[#8B949E] empty:before:content-[attr(data-placeholder)]",
                  LIST_TYPES.has(block.type) ? "min-h-[29px] py-0.5" : "min-h-[34px] py-1",
                  type.className,
                  block.type === "code" && "rounded-md bg-[#111418] px-3 py-2",
                  block.checked && "text-[#8B949E] line-through"
                )}
              >
                {focusedBlockId === block.id ? null : renderLinkedText(block)}
              </div>
            </div>

            {isSlashOpen ? (
              <div
                className={clsx(
                  "absolute left-9 z-50 w-72 overflow-y-auto rounded-xl border border-[#34363D] bg-[#111418] p-1 shadow-[0_22px_70px_rgba(0,0,0,0.42)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  slashMenuLayout.blockId === block.id && slashMenuLayout.direction === "up" ? "bottom-10" : "top-10"
                )}
                style={{ maxHeight: `${slashMenuLayout.blockId === block.id ? slashMenuLayout.maxHeight : 274}px` }}
              >
                {filteredCommands.map((command, commandIndex) => (
                  <button
                    key={command.type}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      convertBlock(block.id, command.type, "");
                    }}
                    className={clsx(
                      "flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors",
                      commandIndex === slashState.selectedIndex ? "bg-[#25272F]" : "hover:bg-[#1A1F27]"
                    )}
                  >
                    <span className="text-sm font-bold text-[#F4F4F5]">{command.label}</span>
                    <span className="text-xs font-semibold text-[#8B949E]">{command.hint}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
    {linkChoicePopup}
    </>
  );
}
