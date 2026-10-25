export const isNumber = value => {
	value = Number(value);
	return !isNaN(value) && typeof value === 'number';
};

export const toLower = (text = '') => text.toLowerCase().trim();
export const toUpper = (text = '') => text.toUpperCase().trim();
export const toCapitalize = (text = '') => text.charAt(0).toUpperCase() + text.slice(1).trim();
export const toCapitalizeWords = (text = '') =>
	text
		.replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters in camelCase
		.replace(/\b([A-Z]{2,})\b/g, word => word) // Keep consecutive uppercase letters unchanged
		.replace(/\b[a-z]/g, char => char.toUpperCase()) // Capitalize the first letter of each word
		.trim();
export const toCapitalizeSentence = (text = '') => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase().trim();
export const toCapitalizeParagraph = (text = '') =>
	text.replace(/(^\w{1}|\.\s+\w{1})/gi, char => char.toUpperCase()).trim();
export const separateWords = text => toCapitalize(text.replace(/([A-Z]+[a-z0-9])/g, ' $1').trim()).trim();

/**
 * Util for formatting JS date object to human readable date
 * @param date JS Date Object that will formatted
 * @returns Human readable date string
 */
export const df = date =>
	new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'long' }).format(date).replace(/\./g, ':');

/** Combining marks untuk efek teks glitch (zalgo ringan). */
const GLITCH_MARKS = [
	'\u0300','\u0301','\u0302','\u0303','\u0304','\u0305','\u0306','\u0307','\u0308','\u030a',
	'\u030b','\u030c','\u0313','\u0314','\u0315','\u0316','\u0317','\u0318','\u0319','\u031a',
	'\u0321','\u0322','\u0323','\u0324','\u0325','\u0326','\u0327','\u0328','\u0329','\u032a',
	'\u0330','\u0331','\u0332','\u0333','\u0334','\u0335','\u0336','\u0337','\u0338','\u033d',
	'\u034e','\u0353','\u0354','\u0355','\u0356','\u0357','\u0358','\u0359','\u035a','\u0360',
];

/**
 * Ubah teks jadi gaya glitch (efek rusak ala hacker).
 * Deterministik: hasil sama setiap dipanggil agar konsisten.
 * @param {string} text teks asli
 * @param {number} intensity 1 = ringan, 2 = sedang, 3 = parah
 */
export const glitch = (text = '', intensity = 1) => {
	let out = '';
	let mi = 0;
	for (const ch of String(text)) {
		out += ch;
		if (!/[a-zA-Z0-9]/.test(ch)) continue;
		const code = ch.charCodeAt(0);
		const count = Math.min(intensity, 1 + ((code + mi) % 2 === 0 ? 1 : 0));
		for (let k = 0; k < count; k++) {
			out += GLITCH_MARKS[(code * 7 + mi * 13 + k * 29) % GLITCH_MARKS.length];
			mi++;
		}
	}
	return out;
};
