import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHttpHandler } from '../src/host/http.ts'
import { createSettingsStore } from '../src/host/settings.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const port = Number(process.env.PORT ?? 4318)

const settings = await createSettingsStore({
  settingsFile: process.env.LIFE_WIKI_SETTINGS || undefined,
})
const apiHandler = createHttpHandler({ settings })

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Life Wiki — 人生知识库</title>
  <style>html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; }</style>
</head>
<body>
  <div id="root"></div>
  <script src="/preview.js"></script>
</body>
</html>`

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
  if (url.pathname.startsWith('/api/life-wiki')) {
    await apiHandler(req, res)
    return
  }
  if (url.pathname === '/preview.js') {
    const js = await readFile(resolve(rootDir, 'lib/preview.js'), 'utf8')
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' })
    res.end(js)
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(html)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Life Wiki preview listening on http://127.0.0.1:${port}`)
})
