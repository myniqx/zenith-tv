import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dllPath = process.argv[2] || path.join(__dirname, '../lib/win32-arm64/libvlc.dll');
const outPath = process.argv[3] || path.join(__dirname, '../lib/win32-arm64/sdk/lib/libvlc.def');

console.log(`Generating .def file from ${dllPath}...`);

// Find MSVC tools
const msvcPath = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC';
const versions = fs.readdirSync(msvcPath);
const latestVersion = versions.sort().reverse()[0];
const dumpbinPath = path.join(msvcPath, latestVersion, 'bin\\HostX64\\arm64\\dumpbin.exe');

console.log(`Using dumpbin: ${dumpbinPath}`);

// Run dumpbin /EXPORTS
const cmd = `"${dumpbinPath}" /EXPORTS "${dllPath}"`;
console.log(`Running: ${cmd}`);
const output = execSync(cmd, { encoding: 'utf8', shell: 'cmd.exe', maxBuffer: 10 * 1024 * 1024 });

// Parse exports
const lines = output.split(/\r?\n/);
const exports = [];
let inExports = false;

console.log(`Total lines in output: ${lines.length}`);

let emptyLines = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.includes('ordinal hint RVA')) {
    inExports = true;
    console.log(`Export table starts at line ${i}`);
    continue;
  }
  if (inExports) {
    // Stop after 3 consecutive empty lines
    if (line.trim() === '') {
      emptyLines++;
      if (emptyLines >= 3) {
        console.log(`Stopped at line ${i} (3 empty lines)`);
        break;
      }
      continue;
    } else {
      emptyLines = 0;
    }

    const match = line.match(/^\s+\d+\s+[0-9A-F]+\s+[0-9A-F]+\s+(\w+)/i);
    if (match) {
      exports.push(match[1]);
    }
  }
}

console.log(`Found ${exports.length} exports`);

// Write .def file
const defContent = `LIBRARY libvlc\nEXPORTS\n${exports.map(e => `    ${e}`).join('\n')}\n`;
fs.writeFileSync(outPath, defContent, 'utf8');

console.log(`Generated ${outPath}`);
