/* Run with Playwright CLI against a fresh, localhost-only browser session.
   This clears that test origin's localStorage. No production account is used. */
async page => {
  const origin = new URL(page.url()).origin;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error('Use a localhost test origin only');
  const results = [], errors = [];
  page.on('pageerror',error => errors.push(error.message));
  const check = (ok,label) => { if (!ok) throw new Error(label); results.push(label); };
  async function seed(settings = {}, progress = null) {
    await page.evaluate(({settings,progress}) => {
      localStorage.clear();
      localStorage.setItem('chord_settings',JSON.stringify({audioEnabled:false,...settings}));
      if (progress) localStorage.setItem('chord_learning_v1',JSON.stringify(progress));
    },{settings,progress});
    await page.goto(origin + '/');
  }
  async function target() {
    return page.evaluate(() => {
      const C = window.ChordTrainer;
      const keyLabel = document.getElementById('keyLabel').textContent;
      const key = keyLabel.split(' ')[0].replace(/♭/g,'b').replace(/♯/g,'#');
      const scale = keyLabel.includes('自然小調') ? 'minor' : 'major';
      const display = document.getElementById('qText').textContent;
      const forward = document.getElementById('qSub').textContent.includes('這個和弦');
      const c = C.catalog(key,scale,'advanced').find(c => forward ? C.formatNote(c.name) === display : c.roman === display);
      if (!c) throw new Error('No target matches rendered question');
      return {roman:c.roman,answerId:c.answerId,name:c.name};
    });
  }
  async function choose(correct = true) {
    const t = await target();
    const roman = correct ? t.roman : await page.locator('#choicesGrid button').evaluateAll((buttons,id) => buttons.find(b => b.dataset.answerId !== id).dataset.roman,t.answerId);
    await page.locator(`#choicesGrid button[data-roman="${roman}"]`).click();
    return t;
  }
  await seed();
  for (const width of [320,375,390,1024]) {
    await page.setViewportSize({width,height:844});
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`Guided home fits ${width}px`);
  }
  await page.screenshot({path:'playwright-artifacts/v1-home-desktop.png',fullPage:true});
  await page.setViewportSize({width:375,height:667});
  await page.screenshot({path:'playwright-artifacts/v1-home-mobile.png',fullPage:true});

  await seed({chordSet:'advanced',selectedRomans:['iii','IV'],answerScope:'full'});
  await page.locator('[data-view="custom"]').click();
  await page.locator('#startCustom').click();
  check(await page.locator('#choicesGrid button').count() === 15,'Advanced major has fifteen unique, grouped choices');
  check(await page.locator('.answer-bank').count() === 2,'Diatonic and chromatic choices are separate');
  const originalOrder = await page.locator('#choicesGrid button').allTextContents();
  for (const width of [320,375,390,768]) {
    await page.setViewportSize({width,height:667});
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`Advanced answer grid fits ${width}px`);
    check(await page.locator('#choicesGrid button').evaluateAll(buttons => buttons.every(b => b.getBoundingClientRect().height >= 48 && b.getBoundingClientRect().width >= 44)),`Answer touch targets fit ${width}px`);
  }
  await page.setViewportSize({width:375,height:667});
  await page.screenshot({path:'playwright-artifacts/v1-advanced-mobile.png',fullPage:true});
  await choose(false);
  check(await page.locator('#answerDetails').getAttribute('open') !== null,'Wrong answer expands its explanation');
  check((await page.locator('#explanationQuality').textContent()).length > 10,'Wrong answer explains chord quality');
  const wrongQuestion = await page.locator('#qText').textContent();
  await page.waitForTimeout(1700);
  check(await page.locator('#qText').textContent() === wrongQuestion && await page.locator('#questionCounter').textContent() === '第 1 / 10 題','Wrong answer waits for the learner instead of auto-advancing');
  check(await page.locator('#reviewCount').textContent() === '1','Wrong answer enters review queue');
  await page.screenshot({path:'playwright-artifacts/v1-explanation-mobile.png',fullPage:true});
  await page.locator('#nextButton').click();
  check(JSON.stringify(originalOrder) === JSON.stringify(await page.locator('#choicesGrid button').allTextContents()),'Choice positions remain stable between questions');
  await page.reload();
  check(await page.locator('#reviewCount').textContent() === '1','Review queue survives reload');
  await page.locator('[data-view="review"]').click();
  await page.locator('#startReview').click();
  check((await page.locator('#questionCounter').textContent()).endsWith('/ 2 題'),'Single mistake schedules two review attempts');
  await choose();
  check(await page.locator('#reviewCount').textContent() === '1','First correct review keeps the mistake pending');
  await page.locator('#nextButton').click(); await choose();
  check(await page.locator('#reviewCount').textContent() === '0','Second consecutive correct review resolves the mistake');
  await page.locator('#nextButton').click();
  check(await page.locator('#summaryAccuracy').textContent() === '100%','Review summary uses this round only');

  await seed();
  await page.locator('[data-lesson="first-three"]').click();
  for (let i = 0; i < 10; i++) { await choose(i !== 5); await page.locator('#nextButton').click(); }
  check(await page.locator('#summaryAccuracy').textContent() === '90%','Guided round counts correct and wrong answers accurately');
  check(await page.locator('#summaryStreak').textContent() === '5','Round best streak retains an earlier peak');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('chord_learning_v1')).lessons['first-three'].completed),'Passing a guided lesson saves completion');
  await page.reload();
  check(await page.locator('[data-lesson="first-three"]').getAttribute('data-complete') === 'true','Guided lesson completion survives reload');
  check(await page.locator('#recommendedTitle').textContent() === '加入小和弦 vi','Home recommends the next incomplete lesson');

  await seed({root:'C',scaleType:'minor',mode:'degreeToChord',chordSet:'advanced',selectedRomans:['iv','v'],answerScope:'full'});
  await page.locator('[data-view="custom"]').click();
  check(await page.locator('#rootSelect option[value="Cb"]').count() === 0,'Minor key picker excludes unsupported major-only roots');
  await page.locator('#startCustom').click();
  check(await page.locator('#choicesGrid button').count() === 11,'Minor advanced removes all four duplicate options');
  const inverseOrder = await page.locator('#choicesGrid button').allTextContents();
  const seen = new Set();
  for (let i = 0; i < 2; i++) {
    const t = await choose(); seen.add(t.roman);
    check(await page.locator('#feedback').getAttribute('data-result') === 'correct',`Inverse minor ${t.roman} is judged correctly`);
    await page.locator('#nextButton').click();
  }
  check(seen.has('iv') && seen.has('v'),'Regression includes both formerly duplicated minor chords');
  check(JSON.stringify(inverseOrder) === JSON.stringify(await page.locator('#choicesGrid button').allTextContents()),'Inverse mode keeps choice positions stable');
  await page.locator('#leaveSession').click();
  await page.locator('#answerScopeSelect').selectOption('selected');
  await page.locator('#startCustom').click();
  check(await page.locator('#choicesGrid button').count() === 2,'Selected answer scope respects the selected two degrees');
  await page.locator('#leaveSession').click();
  while (await page.locator('#degreeFilters input:checked').count()) await page.locator('#degreeFilters input:checked').first().uncheck();
  check(await page.locator('#startCustom').isDisabled(),'Fewer than two selected degrees cannot start a one-choice drill');

  await seed({selectedRomans:['I','IV'],timerEnabled:true,timerDuration:1});
  await page.locator('[data-view="custom"]').click(); await page.locator('#startCustom').click();
  await page.locator('#settingsButton').click();
  await page.keyboard.press('1');
  await page.waitForTimeout(1200);
  check(await page.locator('#feedback').isHidden(),'Timer and answer shortcuts pause while settings is open');
  await page.locator('#settingsDialog button[value="close"]').last().click();
  for (let i = 0; i < 10; i++) {
    await page.locator('#feedback').waitFor({state:'visible',timeout:2500});
    check(await page.locator('#scoreBad').textContent() === String(i + 1),`Timed-out question ${i + 1} is counted exactly once`);
    await page.locator('#nextButton').click();
  }
  check(await page.locator('#summaryBad').textContent() === '10','Ten timed-out questions still finish a round');
  check(await page.locator('#summaryAccuracy').textContent() === '0%','Timeouts are reflected in round accuracy');

  await page.goto(origin + '/dist/index.html');
  check(await page.title() === 'ChordPro｜和弦級數練習','Standalone bundle opens without separate assets');
  await page.addInitScript(() => { Object.defineProperty(window,'localStorage',{get:() => { throw new DOMException('Disabled','SecurityError'); }}); });
  await page.goto(origin + '/');
  check(await page.locator('#storageNotice').isVisible(),'Unavailable browser storage is reported');
  await page.locator('#continueLesson').click(); await choose();
  check(await page.locator('#feedback').isVisible(),'Practice still works when storage is unavailable');
  check(errors.length === 0,`No uncaught browser errors (${errors.join('; ')})`);
  return {passed:results.length,results};
}
