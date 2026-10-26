interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
}

export interface AdfDocument {
  version: 1;
  type: 'doc';
  content: AdfNode[];
}

export function plainTextToAdf(text: string): AdfDocument {
  const lines = (text ?? '').split(/\r?\n/);

  return {
    version: 1,
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line.trim().length > 0 ? [{ type: 'text', text: line }] : [],
    })),
  };
}

export function adfToPlainText(node: unknown): string {
  if (typeof node === 'string') {
    return node;
  }
  if (!node || typeof node !== 'object') {
    return '';
  }

  const current = node as AdfNode;
  if (typeof current.text === 'string') {
    return current.text;
  }
  if (!Array.isArray(current.content)) {
    return '';
  }

  const inner = current.content.map(adfToPlainText).join('');
  return isBlock(current.type) ? `${inner}\n` : inner;
}

function isBlock(type: string): boolean {
  return type === 'paragraph' || type === 'heading' || type === 'listItem' || type === 'codeBlock';
}
