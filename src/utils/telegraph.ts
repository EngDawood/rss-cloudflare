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

/**
 * Converts an HTML string into an array of Telegraph Node objects.
 */
export function htmlToTelegraphNodes(html: string): TelegraphNode[] {
	const $ = cheerio.load(html, null, false);
	const nodes: TelegraphNode[] = [];

	function parseNode(el: cheerio.Element | cheerio.Node): TelegraphNode | null {
		if (el.type === 'text') {
			const text = (el as any).data;
			return text ? text : null;
		}

		if (el.type === 'tag') {
			let tag = el.name.toLowerCase();

			// Map unsupported tags to supported ones
			if (tag === 'h1' || tag === 'h2') tag = 'h3';
			if (tag === 'h5' || tag === 'h6') tag = 'h4';
			if (tag === 'div' || tag === 'section' || tag === 'article') tag = 'p';
			if (tag === 'span') return parseChildren(el); // Ignore tag, keep children

			if (!SUPPORTED_TAGS.has(tag)) {
				// Strip unsupported tag but keep children
				return parseChildren(el) as any;
			}

			const attrs: Record<string, string> = {};
			if (tag === 'a' && el.attribs.href) attrs.href = el.attribs.href;
			if (tag === 'img' && el.attribs.src) attrs.src = el.attribs.src;
			if (tag === 'video' && el.attribs.src) attrs.src = el.attribs.src;
			if (tag === 'iframe' && el.attribs.src) attrs.src = el.attribs.src;

			const children = parseChildrenArray(el);

			const node: TelegraphNodeElement = { tag };
			if (Object.keys(attrs).length > 0) node.attrs = attrs;
			if (children.length > 0) node.children = children;

			return node;
		}

		return null;
	}

	function parseChildrenArray(el: cheerio.Element | cheerio.Node): TelegraphNode[] {
		const children: TelegraphNode[] = [];
		if ((el as cheerio.Element).childNodes) {
			for (const child of (el as cheerio.Element).childNodes) {
				const parsed = parseNode(child);
				if (parsed) {
					if (Array.isArray(parsed)) {
						children.push(...parsed);
					} else {
						children.push(parsed);
					}
				}
			}
		}
		return children;
	}

	function parseChildren(el: cheerio.Element | cheerio.Node): TelegraphNode[] {
		return parseChildrenArray(el);
	}

	$('body').contents().each((_, el) => {
		const parsed = parseNode(el);
		if (parsed) {
			if (Array.isArray(parsed)) {
				nodes.push(...parsed);
			} else {
				nodes.push(parsed);
			}
		}
	});

	// Telegraph requires at least one node
	if (nodes.length === 0) {
		nodes.push({ tag: 'p', children: ['(No content)'] });
	}

	return nodes;
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
