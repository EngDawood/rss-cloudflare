import * as cheerio from 'cheerio';

interface TelegraphNodeElement {
	tag: string;
	attrs?: Record<string, string>;
	children?: TelegraphNode[];
}

type TelegraphNode = string | TelegraphNodeElement;

const SUPPORTED_TAGS = new Set([
	'a', 'aside', 'b', 'blockquote', 'br', 'code', 'em', 'figcaption',
	'figure', 'h3', 'h4', 'hr', 'i', 'iframe', 'img', 'li', 'ol', 'p',
	'pre', 's', 'strong', 'u', 'ul', 'video'
]);

const BLOCK_TAGS = new Set([
	'aside', 'blockquote', 'figure', 'h3', 'h4', 'hr', 'ol', 'p', 'pre', 'ul',
]);

function isBlockNode(node: TelegraphNode): boolean {
	return typeof node !== 'string' && BLOCK_TAGS.has((node as TelegraphNodeElement).tag);
}

function isBrNode(node: TelegraphNode): boolean {
	return typeof node !== 'string' && (node as TelegraphNodeElement).tag === 'br';
}

/**
 * Wrap consecutive inline/text nodes at root level in <p> elements.
 * Block nodes pass through unchanged; leading/trailing <br> are trimmed from each group.
 */
function wrapLooseAtRoot(nodes: TelegraphNode[]): TelegraphNode[] {
	const result: TelegraphNode[] = [];
	let buffer: TelegraphNode[] = [];

	function flushBuffer(): void {
		while (buffer.length > 0 && isBrNode(buffer[0])) buffer.shift();
		while (buffer.length > 0 && isBrNode(buffer[buffer.length - 1])) buffer.pop();
		if (buffer.length > 0) {
			result.push({ tag: 'p', children: [...buffer] });
			buffer = [];
		}
	}

	for (const node of nodes) {
		if (isBlockNode(node)) {
			flushBuffer();
			result.push(node);
		} else {
			buffer.push(node);
		}
	}
	flushBuffer();

	return result;
}

/**
 * Converts an HTML string into an array of Telegraph Node objects.
 */
export function htmlToTelegraphNodes(html: string): TelegraphNode[] {
	const $ = cheerio.load(html);
	const nodes: TelegraphNode[] = [];

	function hasBlockChildren(el: any): boolean {
		return !!(el.childNodes?.some(
			(child: any) => child.type === 'tag' && BLOCK_TAGS.has(child.name.toLowerCase())
		));
	}

	function parseNode(el: any): TelegraphNode | TelegraphNode[] | null {
		if (el.type === 'text') {
			const text = (el as any).data as string;
			if (!text) return null;
			// No newlines: return as-is
			if (!text.includes('\n')) return text;
			// Split on newlines, insert <br> between lines so whitespace isn't collapsed
			const lines = text.split('\n');
			const result: TelegraphNode[] = [];
			for (let i = 0; i < lines.length; i++) {
				if (lines[i]) result.push(lines[i]);
				if (i < lines.length - 1) result.push({ tag: 'br' });
			}
			if (result.length === 0) return null;
			return result.length === 1 ? result[0] : result;
		}

		if (el.type === 'tag') {
			let tag = el.name.toLowerCase();

			if (tag === 'h1' || tag === 'h2') tag = 'h3';
			if (tag === 'h5' || tag === 'h6') tag = 'h4';

			// Container tags: if they contain block-level children, promote children
			// to avoid invalid nested blocks (e.g. <p><p>…</p></p>)
			if (tag === 'div' || tag === 'section' || tag === 'article') {
				if (hasBlockChildren(el)) return parseChildrenArray(el);
				tag = 'p';
			}

			if (tag === 'span') return parseChildrenArray(el);

			if (!SUPPORTED_TAGS.has(tag)) return parseChildrenArray(el);

			const attrs: Record<string, string> = {};
			if (tag === 'a' && el.attribs?.href) attrs.href = el.attribs.href;
			if (tag === 'img' && el.attribs?.src) attrs.src = el.attribs.src;
			if (tag === 'video' && el.attribs?.src) attrs.src = el.attribs.src;
			if (tag === 'iframe' && el.attribs?.src) attrs.src = el.attribs.src;

			const children = parseChildrenArray(el);
			const node: TelegraphNodeElement = { tag };
			if (Object.keys(attrs).length > 0) node.attrs = attrs;
			if (children.length > 0) node.children = children;
			return node;
		}

		return null;
	}

	function parseChildrenArray(el: any): TelegraphNode[] {
		const children: TelegraphNode[] = [];
		if (el.childNodes) {
			for (const child of el.childNodes) {
				const parsed = parseNode(child);
				if (parsed) {
					if (Array.isArray(parsed)) children.push(...parsed);
					else children.push(parsed);
				}
			}
		}
		return children;
	}

	$('body').contents().each((_, el) => {
		const parsed = parseNode(el);
		if (parsed) {
			if (Array.isArray(parsed)) nodes.push(...parsed);
			else nodes.push(parsed);
		}
	});

	// Wrap any loose text/inline nodes at root level into <p> elements
	const result = wrapLooseAtRoot(nodes);
	return result.length > 0 ? result : [{ tag: 'p', children: ['(No content)'] }];
}

/**
 * Creates a Telegraph page using the provided token and HTML content.
 */
export async function createTelegraphPage(
	title: string,
	authorName: string,
	htmlContent: string,
	accessToken: string
): Promise<string | null> {
	if (!accessToken) return null;

	const nodes = htmlToTelegraphNodes(htmlContent);
	const apiUrl = 'https://api.telegra.ph/createPage';

	try {
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				access_token: accessToken,
				title: title.slice(0, 256) || 'Untitled',
				author_name: authorName.slice(0, 128) || 'Bot',
				content: JSON.stringify(nodes),
				return_content: false
			})
		});

		const data: any = await response.json();
		if (data.ok && data.result && data.result.url) {
			return data.result.url;
		}
		console.error('[Telegraph] API Error:', data);
		return null;
	} catch (err) {
		console.error('[Telegraph] Network Error:', err);
		return null;
	}
}
