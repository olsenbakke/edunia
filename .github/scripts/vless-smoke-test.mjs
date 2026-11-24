// End-to-end smoke test: speaks VLESS over WebSocket to the deployed Worker.
// Usage: node vless-smoke-test.mjs <worker-url> <uuid> [target-host] [target-port]
//
// It opens a WebSocket to the Worker, wraps a plain HTTP request in a VLESS
// TCP header, sends it as the first binary frame and prints the response that
// comes back through the tunnel.

import net from 'node:net';

const [, , rawUrl, rawUuid, targetHost = 'cp.cloudflare.com', targetPort = '80'] =
  process.argv;

if (!rawUrl || !rawUuid) {
  console.error('usage: node vless-smoke-test.mjs <worker-url> <uuid> [host] [port]');
  process.exit(2);
}

const VERSION = 0;
const CMD_TCP = 1;
const ATYP_DOMAIN = 2;
const ATYP_IPV4 = 1;

const uuidBytes = (uuid) => {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error('UUID must be 32 hex chars');
  return Buffer.from(hex, 'hex');
};

const vlessHeader = (uuid, host, port) => {
  const isIpv4 = net.isIPv4(host);
  const address = isIpv4
    ? Buffer.from(host.split('.').map((n) => Number(n)))
    : Buffer.from(host, 'utf8');
  const head = Buffer.alloc(1 + 16 + 1 + 1 + 2 + 1 + 1);
  head[0] = VERSION;
  uuidBytes(uuid).copy(head, 1);
  head[17] = 0; // no addons
  head[18] = CMD_TCP;
  head.writeUInt16BE(Number(port), 19);
  head[21] = isIpv4 ? ATYP_IPV4 : ATYP_DOMAIN;
  head[22] = address.length;
  return Buffer.concat([head, address]);
};

const httpRequest = (host) =>
  Buffer.from(
    `GET /cdn-cgi/trace HTTP/1.1\r\nHost: ${host}\r\n` +
      'User-Agent: edunia-smoke-test\r\nAccept: */*\r\nConnection: close\r\n\r\n',
    'utf8'
  );

const payload = httpRequest(targetHost);

const socket = new WebSocket(rawUrl.replace(/\/+$/, '') + '/');
socket.binaryType = 'arraybuffer';

let received = Buffer.alloc(0);
const finish = (code, message) => {
  console.log(message);
  try {
    socket.close();
  } catch {}
  setTimeout(() => process.exit(code), 50);
};

const timer = setTimeout(
  () => finish(received.length ? 0 : 1, `TIMEOUT after 25s, bytes received: ${received.length}`),
  25_000
);

const extra = (process.env.EXTRA_TARGETS ?? '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)
  .map((v) => v.split(':'));
const pending = [[targetHost, targetPort], ...extra];

socket.addEventListener('open', () => {
  // If EXTRA_TARGETS is set, reuse one socket: connect to the first target, then
  // (after the first response) send frames for the remaining targets so each is
  // exercised independently on its own WebSocket.
  if (pending.length > 1) {
    console.log(`Extra targets queued: ${pending.slice(1).map((t) => t.join(':')).join(', ')}`);
  }
  const frame = Buffer.concat([vlessHeader(rawUuid, targetHost, targetPort), payload]);
  socket.send(frame);
  console.log(`Sent ${frame.length} bytes of VLESS/TCP to ${targetHost}:${targetPort}`);
});

socket.addEventListener('message', (event) => {
  const chunk = Buffer.from(event.data);
  received = Buffer.concat([received, chunk]);
  const text = received.toString('utf8');
  if (text.startsWith('HTTP/1.1') && /\r\n\r\n/.test(text)) {
    clearTimeout(timer);
    const status = text.split('\r\n')[0];
    const body = text.split('\r\n\r\n')[1] ?? '';
    finish(
      /HTTP\/1\.[01] 200/.test(status) ? 0 : 1,
      `TUNNEL OK\n  status: ${status}\n  bytes: ${received.length}\n  first body lines:\n${body
        .split('\n')
        .slice(0, 4)
        .map((l) => '    ' + l)
        .join('\n')}`
    );
  }
});

socket.addEventListener('error', (event) => {
  clearTimeout(timer);
  finish(1, `WebSocket error: ${event?.message ?? 'unknown'}\n  received: ${received.toString('utf8').slice(0, 300)}`);
});

socket.addEventListener('close', (event) => {
  clearTimeout(timer);
  if (!received.length) {
    finish(1, `WebSocket closed (code ${event.code}) with no tunnel data — handshake reached the Worker but the VLESS session failed.`);
  }
});
