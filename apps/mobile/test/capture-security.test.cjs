'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadTypeScriptModule(file) {
  const source = read(file);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, URL }, { filename: file });
  return module.exports;
}

test('QR safety permits only explicit http(s) URLs and keeps text inert', () => {
  const { classifyQrPayload, isRepeatedQr } = loadTypeScriptModule('apps/mobile/lib/capture/qr-safety.ts');
  assert.equal(classifyQrPayload('https://example.test/path').kind, 'url');
  assert.equal(classifyQrPayload('http://example.test').kind, 'url');
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/x', 'intent://scan', 'secondbrain://login']) {
    assert.equal(classifyQrPayload(value).kind, 'blocked', value);
  }
  assert.equal(classifyQrPayload('Explain chapter 2').kind, 'text');
  assert.equal(isRepeatedQr('same', 'same'), true);
});

test('web capture never requests audio and releases every media track', () => {
  const capture = read('apps/mobile/components/capture/camera-capture.web.tsx');
  assert.match(capture, /getUserMedia\(\{/);
  assert.match(capture, /audio:\s*false/);
  assert.match(capture, /enumerateDevices\(\)/);
  assert.match(capture, /import \{ releaseMediaStream \}/);
  assert.match(capture, /releaseMediaStream\(/);
  assert.match(capture, /visibilitychange/);
  assert.doesNotMatch(capture, /getUserMedia\(\{[^}]*audio:\s*true/s);
});

test('camera surfaces show an explicit opening or permission state', () => {
  const web = read('apps/mobile/components/capture/camera-capture.web.tsx');
  const native = read('apps/mobile/components/capture/camera-capture.tsx');
  assert.match(web, /\(busy \|\| !ready\)[\s\S]*capture\.permission\.pending/);
  assert.match(web, /accessibilityLiveRegion="polite"/);
  assert.match(native, /permissionBusy[\s\S]*capture\.permission\.pending/);
  assert.match(native, /!ready && !error[\s\S]*capture\.permission\.pending/);
  assert.match(native, /const retake = \(\) => \{[\s\S]*setReady\(false\)[\s\S]*setCaptured\(null\)/);
  assert.match(native, /const switchCamera = \(\) => \{[\s\S]*setReady\(false\)[\s\S]*setFacing/);
});

test('the three visible teaching levels persist coherent legacy preferences', () => {
  const profile = read('apps/mobile/components/profile/components.tsx');
  assert.match(profile, /options=\{\['guided', 'balanced', 'demanding'\]/);
  assert.match(profile, /value=\{displayedLearningSupport\}[\s\S]*wrap/);
  assert.match(profile, /tone:\s*learningSupport === 'guided'[\s\S]*\? 'supportive'[\s\S]*: 'balanced'/);
  assert.match(profile, /tone:\s*learningSupport === 'guided'[\s\S]*learningSupport === 'demanding'[\s\S]*\? 'demanding'/);
  assert.match(profile, /intervention:\s*learningSupport === 'guided'[\s\S]*\? 'guide_me'[\s\S]*: 'interactive'/);
  assert.match(profile, /intervention:\s*learningSupport === 'guided'[\s\S]*learningSupport === 'demanding'[\s\S]*\? 'let_me_think'/);
  assert.match(profile, /learningSupport: 'balanced',[\s\S]*tone: 'balanced',[\s\S]*intervention: 'interactive'/);
  const controls = read('apps/mobile/components/ds/core.tsx');
  assert.match(controls, /wrap \? 'wrap' : 'nowrap'/);
  assert.match(controls, /minWidth: wrap \? 112 : undefined/);
});

test('browser stream cleanup stops tracks and detaches a failed preview', () => {
  const { releaseMediaStream } = loadTypeScriptModule('apps/mobile/lib/capture/media-stream.ts');
  let stopped = 0;
  const candidate = { getTracks: () => [{ stop: () => { stopped += 1; } }, { stop: () => { stopped += 1; } }] };
  const preview = { srcObject: candidate };
  releaseMediaStream(candidate, preview);
  assert.equal(stopped, 2);
  assert.equal(preview.srcObject, null);

  const capture = read('apps/mobile/components/capture/camera-capture.web.tsx');
  assert.match(capture, /catch \(reason\) \{[\s\S]*releaseMediaStream\(next, video\.current\)/);
});

test('scan object URL leases release removed previews only after ownership changes', () => {
  const { createObjectUrlLease } = loadTypeScriptModule('apps/mobile/lib/capture/object-url-lease.ts');
  const revoked = [];
  const lease = createObjectUrlLease((url) => revoked.push(url));

  lease.replace(['blob:page-a', 'blob:page-a', 'file:///native-page.jpg']);
  assert.deepEqual(revoked, []);
  lease.replace(['blob:page-a', 'blob:page-a-edited']);
  assert.deepEqual(revoked, []);
  lease.replace(['blob:page-a']);
  assert.deepEqual(revoked, ['blob:page-a-edited']);
  lease.replace([]);
  assert.deepEqual(revoked, ['blob:page-a-edited', 'blob:page-a']);

  lease.replace(['blob:page-b', 'blob:page-b']);
  lease.releaseAll();
  lease.releaseAll();
  assert.deepEqual(revoked, ['blob:page-a-edited', 'blob:page-a', 'blob:page-b']);
});

test('Scan owns handed-off object URLs and retries the durable failed document', () => {
  const scan = read('apps/mobile/app/scan.tsx');
  assert.match(scan, /objectUrls\.current\.replace\(pages\.flatMap/);
  assert.match(scan, /objectUrls\.current\.releaseAll\(\)/);
  assert.match(scan, /setTimeout\(\(\) => \{[\s\S]*objectUrls\.current\.releaseAll\(\)/);
  assert.match(scan, /clearTimeout\(releaseObjectUrlsTimer\.current\)/);
  assert.match(scan, /setPages\(\[\]\)/);
  assert.match(scan, /payload\?\.documentId/);
  assert.match(scan, /\/retry-scan`/);
  assert.match(scan, /document\.pipeline\.retryOcr/);
  assert.match(scan, /const resetScan = \(\) => \{[\s\S]*setPages\(\[\]\)[\s\S]*uploadRequestId\.current = null/);
  assert.doesNotMatch(scan, /code === 'SCAN_ATTEMPT_FAILED'[\s\S]{0,400}uploadRequestId\.current = null/);
});

test('Learn capture is limited to photo and QR while document import stays in Library', () => {
  const composer = read('apps/mobile/components/learn/universal-composer.tsx');
  const privacy = read('apps/mobile/app/privacy.tsx');
  const library = read('apps/mobile/app/library.tsx');
  assert.match(composer, /learn5\.capture\.photo/);
  assert.match(composer, /const openQr/);
  assert.match(composer, /mode=qr&source=learn/);
  assert.doesNotMatch(composer, /openScan\('document'\)|learn5\.capture\.document|learn5\.capture\.file/);
  assert.doesNotMatch(composer, /learn5\.modality\.import|learn5\.modality\.export|learn-composer-export/);
  assert.match(privacy, /api<DataExportResponse>\('\/me\/export'\)/);
  assert.match(library, /pickDocuments/);
  assert.match(library, /router\.push\('\/scan'\)/);
  assert.match(composer, /<CameraCapture\s+mode="photo"/);
});

test('avatar persistence is authenticated server media, not a global local URI', () => {
  const photo = read('apps/mobile/lib/profile/photo.ts');
  assert.match(photo, /apiUpload\('\/profile\/avatar'/);
  assert.match(photo, /apiBinary\('\/profile\/avatar'\)/);
  assert.match(photo, /method:\s*'DELETE'/);
  assert.doesNotMatch(photo, /AsyncStorage|sb\.avatarPhoto/);
});
