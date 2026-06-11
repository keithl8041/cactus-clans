// Words are base64-encoded to prevent casual source inspection.
// Decoded only at validation time — never logged, rendered, or stored.
const ENCODED: readonly string[] = [
  'YXNz',             // tier1
  'YXJzZQ==',         // tier1
  'YXNzaG9sZQ==',     // tier1
  'YXJzZWhvbGU=',     // tier1
  'YmFzdGFyZA==',     // tier1
  'Yml0Y2g=',         // tier1
  'Ym9sbG9ja3M=',     // tier1
  'Y29jaw==',         // tier1
  'Y3VudA==',         // tier1
  'ZGlja2hlYWQ=',     // tier1
  'ZmFnZ290',         // tier1
  'ZnVjaw==',         // tier1
  'bmlnZ2Vy',         // tier1
  'bmlnZ2E=',         // tier1
  'cGVuaXM=',         // tier1
  'cHJpY2s=',         // tier1
  'cHVzc3k=',         // tier1
  'cmV0YXJk',         // tier1
  'c2hpdA==',         // tier1
  'c2x1dA==',         // tier1
  'dHdhdA==',         // tier1
  'dmFnaW5h',         // tier1
  'd2Fuaw==',         // tier1
  'd2Fua2Vy',         // tier1
  'd2hvcmU=',         // tier1
  'dGl0',             // tier1
  'dGl0cw==',         // tier1
  'c2V4',             // tier1
  'Y3JhcA==',         // tier1
  // "naughty" words
  'Ym9vYg==',         // boob
  'Ym9vYnM=',         // boobs
  'YnVt',             // bum
  'YnV0dA==',         // butt
  'ZmFydA==',         // fart
  'cGVl',             // pee
  'cG9v',             // poo
  'cG9vcA==',         // poop
  'd2Vl',             // wee
  'd2lsbHk='         // willy
];

let _decoded: string[] | null = null;

function getList(): string[] {
  if (!_decoded) _decoded = ENCODED.map((w) => atob(w));
  return _decoded;
}

// Normalise common leet-speak substitutions before checking.
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i')
    .replace(/\s+/g, '');
}

export function containsProfanity(text: string): boolean {
  const n = normalise(text);
  return getList().some((word) => n.includes(word));
}
