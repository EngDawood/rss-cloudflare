export function truncateTitle(text: string, maxLength: number): string {
	const cleaned = text.replace(/\n/g, ' ').trim();
	if (cleaned.length <= maxLength) return cleaned;
	return cleaned.substring(0, maxLength - 1) + '\u2026';
}

// Feed titles that carry no information about the source
const GENERIC_FEED_TITLES = new Set(['', 'untitled feed', 'rss-bridge', 'rsshub']);

/**
 * Pick a readable feed title: the fetched title unless it is generic,
 * otherwise a name derived from the source URL (RSS-Bridge params, RSSHub route, or host+path).
 */
export function feedTitleFromSource(sourceValue: string, fetchedTitle?: string): string {
	const fetched = fetchedTitle?.trim() ?? '';
	if (!GENERIC_FEED_TITLES.has(fetched.toLowerCase())) return fetched;

	const value = sourceValue.trim();
	// RSSHub route stored as path ("/anthropic/news")
	if (value.startsWith('/')) return value.replace(/^\/+/, '').split('?')[0] || value;

	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		return value;
	}
	const host = parsed.hostname.replace(/^www\./, '');
	const params = parsed.searchParams;
	const bridge = params.get('bridge');

	if (bridge) {
		const name = params.get('name')?.trim();
		if (name) return name;
		const bridgeName = bridge.replace(/Bridge$/, '');
		const target = params.get('url') || params.get('home_page') || params.get('feed') || '';
		let targetHost = '';
		try {
			targetHost = target ? new URL(target).hostname.replace(/^www\./, '') : '';
		} catch { /* not a URL */ }
		const subject = targetHost || params.get('u') || params.get('username') || params.get('h') || params.get('q') || '';
		return subject ? `${bridgeName} · ${subject}` : bridgeName;
	}

	const path = parsed.pathname.replace(/\/+$/, '');
	return path ? `${host}${path}` : host;
}

export function processCaption(caption: string): string {
	let html = escapeHtml(caption);

	// Link @mentions
	html = html.replace(/@([\w.]+)/g, '<a href="https://www.instagram.com/$1">@$1</a>');

	// Link #hashtags
	html = html.replace(/#([\w]+)/g, '<a href="https://www.instagram.com/explore/tags/$1">#$1</a>');

	// Newlines to <br>
	html = html.replace(/\n/g, '<br>');

	return html;
}

export function escapeHtml(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
