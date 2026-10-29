import type { AuthoredCoursePackageData, AuthoredQuestionData } from './authored-course';

const encoder = new TextEncoder();
const xml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const crcTable = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; })();
function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

function zip(files: [string, string][]) {
  const locals: Uint8Array[] = []; const centrals: Uint8Array[] = []; let offset = 0;
  for (const [name, source] of files) {
    const filename = encoder.encode(name); const data = encoder.encode(source); const crc = crc32(data);
    const local = new Uint8Array(30 + filename.length + data.length); const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, filename.length, true); lv.setUint16(28, 0, true); local.set(filename, 30); local.set(data, 30 + filename.length); locals.push(local);
    const central = new Uint8Array(46 + filename.length); const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, filename.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true); central.set(filename, 46); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0); const end = new Uint8Array(22); const ev = new DataView(end.buffer); ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
  const all = [...locals, ...centrals, end]; const output = new Uint8Array(all.reduce((n, b) => n + b.length, 0)); let at = 0; for (const chunk of all) { output.set(chunk, at); at += chunk.length; } return output;
}

type DeckSlide = { title: string; points: string[]; sourceIds?: string[]; speaker?: string };
const group = (title: string, points: string[], sourceIds: string[] = []): DeckSlide => ({ title, points, sourceIds });
const assessmentSlides = (title: string, questions: AuthoredQuestionData[]) => questions.map((q, i) => group(`${title} · Question ${i + 1}`, [
  q.prompt, q.selectionType === 'multiple' ? 'Select all correct answers' : 'Select one answer',
  ...q.choices.map((choice, j) => `${String.fromCharCode(65 + j)}. ${choice}`),
], q.sourceIds));
export function courseDeckSlides(course: AuthoredCoursePackageData): DeckSlide[] {
  const slides: DeckSlide[] = [group(course.title, [course.subject, `${course.modules.length} modules · ${course.durationMinutes} planned minutes`])];
  slides.push(group('Course objectives and evidence', course.objectiveEvidence.map(item => `${item.objectiveId}: ${item.objective}`), course.objectiveEvidence.flatMap(item => item.sourceIds)));
  for (const courseModule of course.modules) {
    slides.push(group(`${courseModule.id}: ${courseModule.title}`, [`${courseModule.durationMinutes} planned minutes`, `Objectives: ${courseModule.objectiveIds.join(', ')}`], courseModule.sourceIds));
    slides.push(group(`Problem Hook · ${courseModule.problemHook.title}`, [courseModule.problemHook.situation, `Consider: ${courseModule.problemHook.question}`], courseModule.problemHook.sourceIds));
    for (const video of courseModule.conceptExplainer.videos) {
      slides.push(group(`Concept Explainer · ${video.title}`, [`${video.slides.length} editable content slides · about ${video.plannedMinutes} minutes` ]));
      video.slides.forEach(slide => {
        slides.push(group(slide.title, slide.body, slide.sourceIds));
        if (slide.id === video.midpointQuiz.afterSlideId) slides.push(...assessmentSlides(`Knowledge check · ${video.title}`, video.midpointQuiz.questions));
      });
    }
    courseModule.workedExamples.forEach((example, index) => slides.push(group(`Worked Example ${index + 1} · ${example.title}`, [example.problem, ...example.reasoning, `Result: ${example.result}`], example.sourceIds)));
    slides.push(group(`Guided Practice · ${courseModule.guidedPractice.title}`, [courseModule.guidedPractice.instructions, ...courseModule.guidedPractice.steps.map((s, i) => `${i + 1}. ${s.instruction}`)]));
    courseModule.scenarioLab.scenarios.forEach((scenario, index) => slides.push(group(`Scenario Lab ${index + 1} · ${scenario.title}`, [scenario.situation, `Challenge: ${scenario.challenge}`, `Evidence: ${scenario.expectedEvidence}`], scenario.sourceIds)));
    if (courseModule.moduleQuiz) {
      slides.push(group(`Module quiz · ${courseModule.moduleQuiz.title}`, [courseModule.moduleQuiz.instructions, `Pass rule: ${courseModule.moduleQuiz.passPercent ?? course.courseEnd.masteryGate.passPercent}%`]));
      slides.push(...assessmentSlides(`Module quiz · ${courseModule.moduleQuiz.title}`, courseModule.moduleQuiz.questions));
    }
  }
  slides.push(group(`Course-end Mini Project · ${course.courseEnd.miniProject.title}`, [course.courseEnd.miniProject.brief, `Deliverable: ${course.courseEnd.miniProject.deliverable}`, ...course.courseEnd.miniProject.rubric], course.courseEnd.miniProject.sourceIds));
  const sandbox = course.courseEnd.miniProject.sandbox;
  if (sandbox) {
    slides.push(group('In-course project sandbox', sandbox.instructions));
    slides.push(group('Project grading criteria', sandbox.criteria.map(c => `${course.courseEnd.miniProject.rubric[c.rubricIndex]} (${c.weight} points)`)));
  }
  slides.push(group(`Mastery Gate · ${course.courseEnd.masteryGate.title}`, [`Pass rule: ${course.courseEnd.masteryGate.passPercent}%`, course.courseEnd.masteryGate.instructions]));
  slides.push(...assessmentSlides(`Mastery Gate · ${course.courseEnd.masteryGate.title}`, course.courseEnd.masteryGate.questions));
  slides.push(group('Reflection', course.courseEnd.reflection.prompts));
  return slides;
}

function textShape(id: number, name: string, text: string, x: number, y: number, cx: number, cy: number, size: number, color: string, bold = false, bullet = false) {
  const paras = text.split('\n').map(line => `<a:p><a:pPr${bullet ? ' marL="228600" indent="-228600"' : ''}>${bullet ? '<a:buChar char="•"/>' : '<a:buNone/>'}</a:pPr><a:r><a:rPr lang="en-US" sz="${size}" b="${bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t xml:space="preserve">${xml(line)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="t"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
}

function slideXml(slide: DeckSlide, number: number) {
  const points = slide.points;
  const bodyText = points.length ? points.join('\n') : ' ';
  const citation = slide.sourceIds?.length ? `Sources: ${[...new Set(slide.sourceIds)].join(', ')}` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${textShape(2, 'Slide title', slide.title, 610000, 430000, 8000000, 850000, 2800, '26223A', true)}${textShape(3, 'Slide content', bodyText, 700000, 1500000, 7900000, 3450000, 1800, '353149', false, true)}${citation ? textShape(4, 'Source references', citation, 700000, 4800000, 7900000, 300000, 900, '625B78') : ''}${textShape(5, 'Slide number', String(number), 8200000, 4800000, 250000, 260000, 900, '625B78')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

const relationships = (items: [string, string, string][]) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join('')}</Relationships>`;
const groupTree = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

export function buildCoursePptx(course: AuthoredCoursePackageData) {
  const slides = courseDeckSlides(course);
  const presentationRels: [string, string][] = [['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster'], ...slides.map((_, i) => [`rId${i + 2}`, `slides/slide${i + 1}.xml`] as [string, string])];
  const files: [string, string][] = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', relationships([['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', 'ppt/presentation.xml']])],
    ['ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="9144000" cy="5143500" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`],
    ['ppt/_rels/presentation.xml.rels', relationships(presentationRels.map(([id, target]) => [id, target === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster' ? target : 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', target === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster' ? 'slideMasters/slideMaster1.xml' : target]))],
    ['ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${groupTree}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`],
    ['ppt/slideMasters/_rels/slideMaster1.xml.rels', relationships([['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', '../theme/theme1.xml']])],
    ['ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${groupTree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`],
    ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', relationships([['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster', '../slideMasters/slideMaster1.xml']])],
    ['ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Nebula"><a:themeElements><a:clrScheme name="Nebula"><a:dk1><a:srgbClr val="26223A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="353149"/></a:dk2><a:lt2><a:srgbClr val="F5F3FA"/></a:lt2><a:accent1><a:srgbClr val="6D5EF5"/></a:accent1><a:accent2><a:srgbClr val="4F46A5"/></a:accent2><a:accent3><a:srgbClr val="50BFA5"/></a:accent3><a:accent4><a:srgbClr val="E79A51"/></a:accent4><a:accent5><a:srgbClr val="AA9BFF"/></a:accent5><a:accent6><a:srgbClr val="E87878"/></a:accent6><a:hlink><a:srgbClr val="6D5EF5"/></a:hlink><a:folHlink><a:srgbClr val="625B78"/></a:folHlink></a:clrScheme><a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Nebula"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`],
    ...slides.map((slide, i): [string, string] => [`ppt/slides/slide${i + 1}.xml`, slideXml(slide, i + 1)]),
    ...slides.map((_, i): [string, string] => [`ppt/slides/_rels/slide${i + 1}.xml.rels`, relationships([['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout', '../slideLayouts/slideLayout1.xml']])]),
  ];
  return zip(files);
}
