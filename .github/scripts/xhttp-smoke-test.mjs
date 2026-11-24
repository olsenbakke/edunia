// End-to-end smoke test for the gRPC / xHTTP POST path of the Worker.
// Usage: node xhttp-smoke-test.mjs <worker-url> <uuid> [host] [port]

import net from 'node:net';

const [, , rawUrl, rawUuid, targetHost = 'cp.cloudflare.com', targetPort = '80'] =
  process.argv;

const uuidBytes = (uuid) => Buffer.from(uuid.replace(/-/g, ''), 'hex');

const vlessHeader = (uuid, host, port) => {
  const isIpv4 = net.isIPv4(host);
  const address = isIpv4
    ? Buffer.from(host.split('.').map(Number))
    : Buffer.from(host, 'utf8');
  const head = Buffer.alloc(23);
  head[0] = 0;
  uuidBytes(uuid).copy(head, 1);
  head[17] = 0;
  head[18] = 1; // TCP
  head.writeUInt16BE(Number(port), 19);
  head[21] = isIpv4 ? 1 : 2;
  head[22] = address.length;
  return Buffer.concat([head, address]);
};

const payload = Buffer.from(
  `GET /cdn-cgi/trace HTTP/1.1\r\nHost: ${targetHost}\r\n` +
    'User-Agent: edunia-xhttp-test\r\nAccept: */*\r\nConnection: close\r\n\r\n',
  'utf8'
);

const body = Buffer.concat([vlessHeader(rawUuid, targetHost, targetPort), payload]);

const run = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(rawUrl.replace(/\/+$/, '') + '/', {
      method: 'POST',
      headers: { 'content-type': 'application/grpc', 'x-grpc-web': '1' },
      body,
      signal: controller.signal,
    });
    console.log(`POST -> HTTP ${res.status}, content-type: ${res.headers.get('content-type')}`);
    const reader = res.body.getReader();
    let received = Buffer.alloc(0);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received = Buffer.concat([received, Buffer.from(value)]);
      const text = received.toString('utf8');
      if (text.startsWith('HTTP/1.1') && text.includes('\r\n\r\n')) break;
    }
    clearTimeout(timer);
    const text = received.toString('utf8');
    const status = text.split('\r\n')[0] || '(no data)';
    const ok = /HTTP\/1\.[01] 200/.test(status);
    console.log(`TUNNEL ${ok ? 'OK' : 'FAILED'}\n  status: ${status}\n  bytes: ${received.length}`);
    process.exit(ok ? 0 : 1);
  } catch (e) {
    clearTimeout(timer);
    console.log(`FAILED: ${e?.name === 'AbortError' ? 'timeout after 25s' : e?.message}`);
    process.exit(1);
  }
};

run();
