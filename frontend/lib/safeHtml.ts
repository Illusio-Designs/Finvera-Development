import sanitize from 'sanitize-html';

/** Preserve editor formatting while preventing saved markup from executing code. */
export function safeHtml(value: string | null | undefined): string {
  return sanitize(value || '', {
    allowedTags: [...sanitize.defaults.allowedTags, 'img', 'h1', 'h2'],
    allowedAttributes: {
      '*': ['class', 'id', 'style'],
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      ol: ['start'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan', 'scope'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/], color: [/^#[0-9a-f]{3,8}$/i], 'background-color': [/^#[0-9a-f]{3,8}$/i] } },
    transformTags: { a: sanitize.simpleTransform('a', { rel: 'noopener noreferrer' }) },
  });
}
