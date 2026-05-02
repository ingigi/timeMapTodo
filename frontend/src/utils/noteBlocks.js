export const NOTE_BLOCK_TYPES = {
  paragraph: { label: "Text" },
  h1: { label: "Heading 1" },
  h2: { label: "Heading 2" },
  h3: { label: "Heading 3" },
  bullet: { label: "Bulleted list" },
  numbered: { label: "Numbered list" },
  todo: { label: "Todo list" },
  quote: { label: "Quote" },
  code: { label: "Code block" }
};

export const createNoteBlock = (overrides = {}) => {
  const id = overrides.id || globalThis.crypto?.randomUUID?.() || `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    type: "paragraph",
    text: "",
    checked: false,
    indent: 0,
    ...overrides,
    id
  };
};

export const createNoteBlocksFromText = (text = "") => {
  if (!text) return [createNoteBlock()];
  return text.split(/\r?\n/).map((line) => createNoteBlock({ text: line }));
};

export const normalizeNoteBlocks = (blocks, fallbackText = "") => {
  if (!Array.isArray(blocks) || blocks.length === 0) return createNoteBlocksFromText(fallbackText);

  return blocks.map((block) =>
    createNoteBlock({
      id: block.id,
      type: NOTE_BLOCK_TYPES[block.type] ? block.type : "paragraph",
      text: typeof block.text === "string" ? block.text : "",
      checked: Boolean(block.checked),
      indent: Math.max(0, Math.min(4, Number(block.indent) || 0)),
      mentions: Array.isArray(block.mentions)
        ? block.mentions
            .map((mention) => ({
              id: mention.id || globalThis.crypto?.randomUUID?.() || `mention_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              start: Math.max(0, Number(mention.start) || 0),
              end: Math.max(0, Number(mention.end) || 0),
              label: typeof mention.label === "string" ? mention.label : "",
              url: typeof mention.url === "string" ? mention.url : ""
            }))
            .filter((mention) => mention.label && mention.url && mention.end > mention.start)
        : []
    })
  );
};

export const blocksToPlainText = (blocks = []) => normalizeNoteBlocks(blocks).map((block) => block.text || "").join("\n");
