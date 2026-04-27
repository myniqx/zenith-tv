import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const distDir = path.resolve(root, 'dist')
const outputPath = path.resolve(root, 'Debug', 'tizen.wgt')

async function createWgt() {
  if (!fs.existsSync(distDir)) {
    console.error('Error: dist directory not found. Run "pnpm build" first.')
    process.exit(1)
  }

  fs.mkdirSync(path.resolve(root, 'Debug'), { recursive: true })

  const output = fs.createWriteStream(outputPath)
  const archive = archiver('zip', { zlib: { level: 9 } })

  output.on('close', () => {
    console.log(`Created zenith-tv.wgt (${(archive.pointer() / 1024).toFixed(1)} KB)`)
  })

  archive.on('error', (err) => { throw err })
  archive.pipe(output)

  // dist/ içeriğini root seviyeye koy (dist/index.html → index.html), test klasörü hariç
  archive.glob('**/*', {
    cwd: distDir,
    ignore: ['test/**', 'test'],
  })

  // proje tanım dosyaları
  archive.file(path.join(root, 'config.xml'), { name: 'config.xml' })

  // imza dosyaları (varsa)
  const authorSig = path.join(root, 'author-signature.xml')
  const distSig = path.join(root, 'signature1.xml')
  if (fs.existsSync(authorSig)) archive.file(authorSig, { name: 'author-signature.xml' })
  if (fs.existsSync(distSig)) archive.file(distSig, { name: 'signature1.xml' })

  await archive.finalize()
}

createWgt().catch(console.error)
