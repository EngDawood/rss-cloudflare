import { InlineKeyboard } from 'grammy';
import type { FormatSettings } from '../../../types/telegram';
import { FORMAT_LABELS } from '../../../constants';
import { FORMAT_SETTING_KEYS, CUSTOM_TEXT_SETTING_KEYS, formatValueText } from '../helpers/format-settings';
import { resolveFormatSettings } from '../../../utils/telegram-format';

/**
 * Build RSStT-style format settings keyboard (one button per setting, click to cycle).
 */
export function buildFormatKeyboard(
	current: FormatSettings,
	callbackPrefix: string, // 'fs:CHID:SRCID', 'fd:CHID' or 'fg' (bot-wide)
	backCallback: string,
	resetCallback: string
): InlineKeyboard {
	const kb = new InlineKeyboard();
	kb.text('Reset to defaults', resetCallback).row();
	
	for (const key of FORMAT_SETTING_KEYS) {
		const label = FORMAT_LABELS[key].label;
		const valueText = formatValueText(key, current[key]);
		kb.text(`${label}: ${valueText}`, `${callbackPrefix}:${key}`).row();
	}

	// Custom text settings (header, footer, hashtags)
	for (const key of CUSTOM_TEXT_SETTING_KEYS) {
		const label = FORMAT_LABELS[key].label;
		const val = current[key];
		const strVal = String(val);
		const display = val ? (strVal.length > 20 ? strVal.substring(0, 17) + '...' : strVal) : 'Not set';
		// Prefix 'fsc' (format setting custom) to distinguish from cycling ones
		const customPrefix = callbackPrefix === 'fg' ? 'fgc' : callbackPrefix.replace('fs', 'fsc').replace('fd', 'fdc');
		kb.text(`${label}: ${display}`, `${customPrefix}:${key}`).row();
	}
	
	kb.text('Cancel', backCallback);
	return kb;
}

/**
 * Bot-wide default format page: text + keyboard (fg:SETTING cycles, fg_r resets, fg_x closes).
 */
export function buildGlobalFormatView(globalFormat: Partial<FormatSettings>): { text: string; keyboard: InlineKeyboard } {
	return {
		text:
			`<b>Bot default settings</b>\n\n` +
			`These apply to every channel. Channel defaults (<code>/set_default @channel</code>) ` +
			`and source settings (<code>/set</code>) override them.`,
		keyboard: buildFormatKeyboard(resolveFormatSettings(undefined, undefined, globalFormat), 'fg', 'fg_x', 'fg_r'),
	};
}
