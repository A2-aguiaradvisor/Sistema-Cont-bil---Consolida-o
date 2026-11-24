/* TEMPORARY build entry for the XLSX analysis build (dev mode): runs the analysis script once, then emits nothing.
   This file and the whole analysis-temp/ folder are deleted before commit. */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

if (!fs.existsSync(path.resolve('analysis-temp/dump.json'))) {
  try {
    execFileSync(process.execPath, ['analysis-temp/analyze-xlsx.mjs'], {
      stdio: 'inherit',
      timeout: 120000,
    })
  } catch (e) {
    console.error('xlsx analysis failed (non-fatal)', e)
  }
}
void fs
void execFileSync
void path

export default function TempEntry() {
  return null
}
// v4 - waiting for run_qa cycle
