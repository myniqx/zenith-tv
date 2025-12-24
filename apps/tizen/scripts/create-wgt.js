import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const distDir = path.resolve(__dirname, '../dist')
const outputPath = path.resolve(__dirname, '../zenith-tv.wgt')

async function createWgt() {
  if (!fs.existsSync(distDir)) {
    console.error('Error: dist directory not found. Run "pnpm build" first.')
    process.exit(1)
  }

  // Copy config.xml to dist
  const configXml = path.resolve(__dirname, '../config.xml')
  const distConfigXml = path.resolve(distDir, 'config.xml')
  fs.copyFileSync(configXml, distConfigXml)

  // Create archive
  const output = fs.createWriteStream(outputPath)
  const archive = archiver('zip', {
    zlib: { level: 9 }
  })

  output.on('close', () => {
    console.log(`✓ Created zenith-tv.wgt (${archive.pointer()} bytes)`)
  })

  archive.on('error', (err) => {
    throw err
  })

  archive.pipe(output)
  archive.directory(distDir, false)
  await archive.finalize()
}

createWgt().catch(console.error)
