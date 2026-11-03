// Passwords and codes typed into the chat ("investor password: Abc123!") are
// masked before the message is stored, shown to the model or forwarded in an
// alert. The member sees "[hidden]" in their own history, which also tells
// them it wasn't kept. Masking a harmless word now and then is the price of
// never keeping a real password.

export const HIDDEN = "[hidden]";

const SECRET_PATTERNS: readonly RegExp[] = [
  // English, Malay, Indonesian: a secret word, a separator, then the value.
  /\b((?:investor |master |trading |mt[45] )?pass(?:word|wd)?|pwd|passcode|pin|otp|one[- ]time code|verification code|seed(?: phrase)?|recovery phrase|private key|api key|secret|kata ?laluan|kata ?sandi|sandi|kod (?:pengesahan|otp)|kode (?:verifikasi|otp))(\s*(?:is|:|=|adalah|ialah|ialah:)\s*|\s*:\s*)(\S+)/gi,
  // Chinese: 密码 / 验证码 / 私钥 / 助记词, a separator (是, ：, =), then the
  // value — but not a question ("密码是什么?").
  /((?:投资者|主|交易)?(?:密码|密碼|验证码|驗證碼|私钥|私鑰|助记词|助記詞))(\s*(?:是|为|為|:|：|=)\s*)(?!什么|什麼|甚麼|多少|哪)([^\s，。？！]+)/g,
];

export function maskSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (out, re) => out.replace(re, (_m, label: string, sep: string) => `${label}${sep}${HIDDEN}`),
    text
  );
}
