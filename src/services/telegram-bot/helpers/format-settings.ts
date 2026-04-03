import { FORMAT_LABELS } from '../../../constants';
import type { FormatSettings } from '../../../types/telegram';

export const FORMAT_SETTING_KEYS: (keyof FormatSettings)[] = [
	'notification', 'media', 'author', 'sourceFormat', 'linkPreview', 'lengthLimit', 'fallbackMode', 'hashtags', 'removeTikTokViews',
];

export const CUSTOM_TEXT_SETTING_KEYS: (keyof FormatSettings)[] = [
	'customHeader', 'customFooter', 'customHashtags', 'cleanupText',
];

/**
 * Get the next option value for a setting (cycles through options list).
 */
export function cycleFormatValue(setting: keyof FormatSettings, current: string | number): string {
	const options = FORMAT_LABELS[setting].options;
	if (!options) return String(current);
	const idx = options.findIndex((o) => String(o.value) === String(current));
	return String(options[(idx + 1) % options.length].value);
}

/**
 * Get display text for a setting's current value.
 */
export function formatValueText(setting: keyof FormatSettings, value: string | number | undefined): string {
	const opt = FORMAT_LABELS[setting].options?.find((o) => String(o.value) === String(value));
	if (opt) return opt.text;
	if (value === undefined || value === '') return 'Not set';
	return String(value);
}
