// Passwords and codes a member types ("investor password: Abc123!") — in the
// in-app chat or on Telegram — are masked before the message is stored, shown
// to the model or forwarded in an alert. In the app the member sees "[hidden]"
// in their own history, which also tells them it wasn't kept. Masking a
// harmless word now and then is the price of never keeping a real password.
//
// After a label, an explicit separator (":", "=", "：", " - ", "是") masks
// whatever follows. A plain space or "is" / "adalah" / "ialah" masks only a
// value shaped like a secret (a digit or a password symbol), so "my password
// is wrong" stays readable. A deposit reference (MM-xxxxxx) is never masked:
// it is how the member is found.

export const HIDDEN = "[hidden]";

const REF_CODE = /^MM-[0-9a-f]{6}\b/i;
/** A digit, or a symbol people put in passwords (not an apostrophe or a full stop). */
const SECRET_SHAPE = /[\d!@#$%^&*_+=~|\\/<>{}[\]]/;
const EXPLICIT = /[:=：–—-]|是|为|為/;

const LABEL = String.raw`(?:(?:investor|master|trading|mt[45])\s+)?(?:pass(?:word|wd|code)?|pwd|pw|pin|otp|one[- ]time (?:code|password)|verification code|private key|api key|secret(?: key)?|kata ?laluan|kata ?sandi|sandi|kod (?:pengesahan|otp|pin)|kode (?:verifikasi|otp|pin))`;
/** "passwordnya", "password saya", "kata laluan saya". */
const FILLER = String.raw`(?:nya|ku)?(?:\s+(?:saya|aku|anda|ku))?`;
const SEP = String.raw`(\s*[:=：]\s*|\s+[-–—]\s+|\s+(?:is|adalah|ialah)\s+|\s+)`;

const LATIN = new RegExp(String.raw`\b(${LABEL}${FILLER})\b${SEP}(\S+)`, "gi");
const CHINESE = new RegExp(
  String.raw`((?:投资者|投資者|主|交易|登录|登入)?(?:密码|密碼|口令|验证码|驗證碼|PIN码|PIN碼|pin码|私钥|私鑰))(\s*(?:是|为|為|:|：|=)\s*|\s+)(?!什么|什麼|甚麼|多少|哪|忘|错|錯|对|對|不|无效|無效)([^\s，。？！,]+)`,
  "g"
);
/** A seed or recovery phrase is several words: everything to the end of the line goes. */
const PHRASE = /\b((?:seed|recovery|backup)\s+(?:phrase|words)|mnemonic)(\s*[:=：]\s*)([^\n]+)/gi;
const PHRASE_ZH = /(助记词|助記詞|恢复短语|恢復短語)(\s*(?:是|:|：|=)\s*)([^\n]+)/g;

function mask(label: string, sep: string, value: string, whole: string): string {
  if (REF_CODE.test(value)) return whole;
  if (!EXPLICIT.test(sep) && !SECRET_SHAPE.test(value)) return whole;
  return `${label}${sep}${HIDDEN}`;
}

export function maskSecrets(text: string): string {
  return text
    .replace(PHRASE, (_m, label: string, sep: string) => `${label}${sep}${HIDDEN}`)
    .replace(PHRASE_ZH, (_m, label: string, sep: string) => `${label}${sep}${HIDDEN}`)
    .replace(LATIN, (whole, label: string, sep: string, value: string) => mask(label, sep, value, whole))
    .replace(CHINESE, (whole, label: string, sep: string, value: string) => mask(label, sep, value, whole));
}
