import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.md': 'text/plain' };

export async function startServer({ root = resolve('site'), port = 4179 } = {}) {
  const base = await realpath(root);
  const server = createServer(async (req, res) => {
    const send = (code, text) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(text); };
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, '此预览只支持读取。');
    let pathname;
    try { pathname = decodeURIComponent(req.url.split('?')[0]); } catch { return send(400, '无效路径。'); }
    let target = resolve(base, `.${pathname}`);
    if (target !== base && !target.startsWith(base + sep)) return send(403, '不能读取站点之外的文件。');
    try {
      if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
      target = await realpath(target);
      if (!target.startsWith(base + sep)) return send(403, '不能读取站点之外的文件。');
      const content = await readFile(target);
      res.writeHead(200, { 'Content-Type': `${types[extname(target)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { send(404, '这个页面不存在。'); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startServer({ port: Number(process.argv[2] || 4179) });
  console.log(`章法预览：http://127.0.0.1:${server.address().port}`);
}
