const fs = require('fs')
const p = 'app/(teacher)/learn/builder/page.tsx'
let s = fs.readFileSync(p, 'utf8')
const re = /import \{\r?\n  configToApiContext,\r?\n  loadingMessageForConfig,\r?\n  normalizeGeneratedModules,\r?\n  type CourseAiConfig,\r?\n  type CourseModule,\r?\n\} from '@\/lib\/ai-course-generation'/
const next = [
  "import {",
  "  configToCourseApiContext,",
  "  loadingMessageForCourseConfig,",
  "  normalizeGeneratedModules,",
  "  type CourseAiConfig,",
  "  type GeneratedCourseModule,",
  "} from '@/lib/ai-course-generation'",
].join('\n')
if (!re.test(s)) {
  console.log('no match')
  process.exit(1)
}
s = s.replace(re, next)
fs.writeFileSync(p, s)
console.log('builder import block fixed')
console.log(s.split(/\r?\n/).slice(17, 25).join('\n'))
