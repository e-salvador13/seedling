import { defineConfig, type Plugin } from 'vite'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/** Dev only: the lab can POST trained weights here so they ship with the site. */
function saveWeights(): Plugin {
  return {
    name: 'save-weights',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__weights', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        const id = (req.url ?? '').replace(/^\//, '').replace(/[^a-z]/g, '')
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          mkdirSync(resolve('public/weights'), { recursive: true })
          writeFileSync(resolve(`public/weights/${id}.json`), body)
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: true, id, bytes: body.length }))
        })
      })
    },
  }
}

export default defineConfig({ base: './', plugins: [saveWeights()] })
