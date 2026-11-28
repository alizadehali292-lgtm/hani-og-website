/**
 * Serialize data for an inline <script type="application/ld+json">.
 *
 * JSON.stringify leaves "<", ">" and "&" as-is, so a value containing
 * "</script>" (e.g. a salon name edited in /admin/asetukset) would close the
 * tag and let the rest run as HTML. Escaping them as < etc. keeps the
 * JSON identical when parsed. U+2028/U+2029 are escaped for old parsers.
 */
// Built from char codes so no raw separator characters sit in this source file.
const LS = new RegExp(String.fromCharCode(0x2028), "g");
const PS = new RegExp(String.fromCharCode(0x2029), "g");

export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LS, "\\u2028")
    .replace(PS, "\\u2029");
}
