/**
 * .debug — diagnostik session (untuk clone/jadibot).
 * Menampilkan status handler, command, dan koneksi session saat ini.
 */

export default {
	name: 'debug',
	category: 'owner',
	description: 'Diagnostik session bot (handler, command, koneksi)',
	hidden: true, // tidak tampil di menu otomatis
	async run(ctx) {
		const { hisoka, m } = ctx;

		const isClone = !!hisoka._isClone;
		const sessionId = hisoka._sessionId || hisoka._cloneNumber || 'main';
		const label = isClone ? `bot_${sessionId}` : 'main';

		let cloneInfo = null;
		if (isClone) {
			try {
				const { getCloneDebug } = await import('../../helper/jadibot.js');
				cloneInfo = getCloneDebug(sessionId);
			} catch {}
		}

		const commands = hisoka.loadedCommands?.length || 0;

		let text = `🔍 *DEBUG SESSION*\n\n`;
		text += `Session: ${label}\n`;
		text += `Status: ${hisoka.user ? 'ONLINE' : 'OFFLINE'}\n`;
		text += `Nomor: ${hisoka.user?.id?.split('@')[0] || '?'}\n\n`;

		if (cloneInfo) {
			text += `Message Handler: ${cloneInfo.messageHandler}\n`;
			text += `Command Handler: ${cloneInfo.commandHandler}\n`;
			text += `Event Handler: ${cloneInfo.eventHandler}\n`;
			text += `Middleware: ${cloneInfo.middleware}\n`;
			text += `Features: ${cloneInfo.features}\n`;
			text += `Commands: ${cloneInfo.commands}\n`;
			text += `Plugins: ${cloneInfo.plugins}\n`;
		} else {
			text += `Message Handler: ON\n`;
			text += `Command Handler: ON (${commands} commands)\n`;
			text += `Event Handler: ON\n`;
			text += `Tipe: ${isClone ? 'Clone' : 'Bot Utama'}\n`;
		}

		await m.reply(text);
	},
};
