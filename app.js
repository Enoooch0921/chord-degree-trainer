/* UI for the static GitHub Pages app. */
(() => {
  'use strict';
  const C = window.ChordTrainer;
  const $ = id => document.getElementById(id);
  const text = (id,value) => { $(id).textContent = value; };
  const node = (tag,className,content) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  };
  const SETTINGS_KEY = 'chord_settings';
  const PROGRESS_KEY = 'chord_learning_v1';
  function storageNotice() {
    text('storageNotice','這個瀏覽器目前無法儲存進度；仍可練習，但關閉或重新整理後，本次紀錄可能遺失。');
    $('storageNotice').hidden = false;
  }
  function readStored(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (error) {
      if (error instanceof SyntaxError) return null;
      storageNotice();
      return null;
    }
  }
  function saveStored(key,value) {
    try { localStorage.setItem(key,JSON.stringify(value)); }
    catch (_) { storageNotice(); }
  }
  let settings = C.normalizeSettings(readStored(SETTINGS_KEY) || {});
  let progress = C.normalizeProgress(readStored(PROGRESS_KEY));
  let activeView = 'guided';
  let session = null;
  let clockHandle = null;
  const dialog = $('settingsDialog');
  const saveSettings = () => saveStored(SETTINGS_KEY,settings);
  const saveProgress = () => { saveStored(PROGRESS_KEY,progress); updateCounts(); };
  const pending = () => C.pendingReviews(progress);
  const clearClock = () => { clearTimeout(clockHandle); clockHandle = null; };
  function updateCounts() {
    text('reviewCount',pending().length);
    text('homeReviewCount',pending().length);
  }
  function navigate(view,focus = true) {
    if (!['guided','custom','review'].includes(view)) view = 'guided';
    clearClock();
    session = null;
    activeView = view;
    $('homeView').hidden = false;
    $('practiceView').hidden = true;
    $('summaryView').hidden = true;
    for (const name of ['guided','custom','review']) {
      $(name + 'Panel').hidden = name !== view;
      document.querySelector(`[data-view="${name}"]`).setAttribute('aria-current',name === view ? 'page' : 'false');
    }
    const headings = {
      guided:['一步一步，把級數練熟','今天，從這裡開始。','每回合 10 題。答錯時慢慢看懂，再往下一題走。'],
      custom:['照自己的步調練習','今天，想練什麼？','選擇調性與範圍，安排適合自己的 10 題練習。'],
      review:['把容易混淆的地方，練得更穩','給錯題，再一次機會。','先前答錯的題目會留在這裡，重新開啟也能接著練。']
    };
    ['homeEyebrow','homeTitle','homeDescription'].forEach((id,i) => text(id,headings[view][i]));
    updateCounts();
    if (view === 'guided') renderGuided();
    if (view === 'custom') renderCustom();
    if (view === 'review') renderReviews();
    if (focus) { $('homeTitle').setAttribute('tabindex','-1'); $('homeTitle').focus({preventScroll:true}); window.scrollTo(0,0); }
  }
  function renderGuided() {
    const completed = C.LESSONS.filter(l => progress.lessons[l.id]?.completed).length;
    text('lessonCount',`${completed} / ${C.LESSONS.length} 完成`);
    $('lessonList').replaceChildren(...C.LESSONS.map((lesson,i) => {
      const record = progress.lessons[lesson.id];
      const button = node('button','lesson');
      button.type = 'button';
      button.dataset.lesson = lesson.id;
      button.dataset.complete = Boolean(record?.completed);
      button.append(node('span','lesson-number',record?.completed ? '✓' : String(i + 1)));
      const copy = node('span','lesson-copy');
      copy.append(node('span','lesson-title',lesson.title),node('span','lesson-detail',lesson.description));
      button.append(copy,node('span','lesson-state',record ? `最高 ${record.bestAccuracy}%` : lesson.tag));
      button.addEventListener('click',() => startLesson(lesson));
      return button;
    }));
    const recommended = C.LESSONS.find(l => !progress.lessons[l.id]?.completed) || C.LESSONS[0];
    text('recommendedTitle',completed === C.LESSONS.length ? '全部完成！再鞏固一次。' : recommended.title);
    text('recommendedDescription',completed === C.LESSONS.length ? '也可以試試自由練習，或回頭複習容易混淆的級數。' : recommended.description);
    text('continueLesson',completed ? '接續練習 →' : '開始第一個單元 →');
    $('continueLesson').onclick = () => startLesson(recommended);
    text('homeReviewDescription',pending().length ? `有 ${pending().length} 個級數等你再練一次。保留原本的調性與題目方向。` : '答錯的題目會自動收進來，之後可以集中練習。');
  }
  function renderReviews() {
    const reviews = pending();
    $('startReview').disabled = !reviews.length;
    text('startReview',reviews.length ? `開始複習（最多 10 題）` : '目前沒有待複習題目');
    if (!reviews.length) {
      const empty = node('div','empty-state');
      empty.append(node('h3','', '目前沒有待複習的錯題'),node('p','', '開始一回合練習；遇到還不熟的題目，就會自動記在這裡。'));
      const button = node('button','secondary-button','去引導練習'); button.type = 'button';
      button.onclick = () => navigate('guided'); empty.append(button);
      $('reviewList').replaceChildren(empty);
      return;
    }
    $('reviewList').replaceChildren(...reviews.map(record => {
      const chord = C.catalog(record.key,record.scaleType,'advanced').find(c => c.roman === record.roman);
      const row = node('article','review-row');
      const left = node('div');
      left.append(node('strong','',`${record.roman} · ${C.formatNote(chord.name)}`),node('span','small',`${C.formatNote(record.key)} ${C.scaleLabel(record.scaleType)} · ${record.mode === 'chordToDegree' ? '和弦 → 級數' : '級數 → 和弦'}`));
      const right = node('div','review-row-right');
      right.append(node('span','',`錯過 ${record.misses} 次`),node('span','small',`複習連答 ${record.correctStreak} / 2`));
      row.append(left,right); return row;
    }));
  }
  function renderCustom() {
    for (const [id,key] of Object.entries({modeSelect:'mode',scaleSelect:'scaleType',keymodeSelect:'keymode',chordSetSelect:'chordSet',answerScopeSelect:'answerScope'})) $(id).value = settings[key];
    const keys = settings.scaleType === 'minor' ? C.MINOR_KEYS : C.MAJOR_KEYS;
    $('rootSelect').replaceChildren(...keys.map(key => { const option = node('option','',C.formatNote(key)); option.value = key; return option; }));
    $('rootSelect').value = settings.root;
    $('rootSelect').disabled = settings.keymode === 'random';
    renderFilters();
  }
  function renderFilters() {
    const all = C.catalog(settings.root,settings.scaleType,settings.chordSet);
    if (!settings.selectedRomans) settings.selectedRomans = all.map(c => c.roman);
    const sections = [];
    for (const group of ['diatonic','chromatic']) {
      const items = all.filter(c => c.group === group);
      if (!items.length) continue;
      const wrapper = node('div');
      wrapper.append(node('p','filter-group-label',group === 'diatonic' ? '順階和弦' : '變化和弦'));
      const choices = node('div','filter-options');
      for (const chord of items) {
        const label = node('label','filter-option');
        const input = node('input'); input.type = 'checkbox'; input.value = chord.roman;
        input.checked = settings.selectedRomans.includes(chord.roman);
        input.setAttribute('aria-label',`練習 ${chord.roman}`);
        label.append(input,node('span','',chord.roman));
        input.addEventListener('change',() => {
          settings.selectedRomans = [...$('degreeFilters').querySelectorAll('input:checked')].map(i => i.value);
          saveSettings(); updateFilterCount();
        });
        choices.append(label);
      }
      wrapper.append(choices); sections.push(wrapper);
    }
    $('degreeFilters').replaceChildren(...sections);
    updateFilterCount();
  }
  function updateFilterCount() {
    const count = settings.selectedRomans.length;
    text('filterCount',`已選 ${count} 個級數`);
    text('filterMessage',count < 2 ? '請至少選擇 2 個級數，讓每題都能練習辨認。' : settings.answerScope === 'full' ? '只從勾選的級數出題，答案仍顯示和弦集內全部選項。' : '只從勾選的級數出題，答案也只顯示這些選項。');
    $('startCustom').disabled = count < 2;
  }
  function startLesson(lesson) { startSession('guided',C.lessonConfig(lesson),lesson.id); }
  function startReview() {
    const questions = C.buildReviewRound(progress);
    if (!questions.length) { navigate('review'); return; }
    startSession('review',null,null,questions);
  }
  function startSession(kind,config,lessonId = null,questions = null) {
    clearClock();
    const deck = questions || C.buildRound(config);
    activeView = kind === 'custom' ? 'custom' : kind === 'review' ? 'review' : 'guided';
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-current',button.dataset.view === activeView ? 'page' : 'false'));
    session = { kind,config,lessonId,questions:deck,index:0,answers:[],ok:0,bad:0,streak:0,bestStreak:0,phase:'question',timerEnabled:settings.timerEnabled,timerDuration:settings.timerDuration,remaining:0,deadline:0 };
    $('homeView').hidden = true; $('practiceView').hidden = false; $('summaryView').hidden = true;
    const title = kind === 'review' ? '錯題複習' : kind === 'guided' ? C.LESSONS.find(l => l.id === lessonId).title : '自由練習';
    text('sessionTitle',title);
    $('roundProgress').setAttribute('aria-valuemax',deck.length);
    renderQuestion();
  }
  function renderQuestion() {
    clearClock();
    const q = session.questions[session.index];
    session.phase = 'question';
    session.remaining = session.timerDuration * 1000;
    $('feedback').hidden = true; $('replayBtn').hidden = true;
    text('answerAnnouncement','');
    text('keyLabel',`${C.formatNote(q.key)} ${C.scaleLabel(q.scaleType)}`);
    text('qSub',q.mode === 'chordToDegree' ? '這個和弦，是第幾級？' : '這個級數，對應什麼和弦？');
    text('qText',q.mode === 'chordToDegree' ? C.formatNote(q.target.name) : q.target.roman);
    text('questionCounter',`第 ${session.index + 1} / ${session.questions.length} 題`);
    updateSessionStats();
    const groups = [];
    for (const group of ['diatonic','chromatic']) {
      const chords = q.choices.filter(c => c.group === group);
      if (!chords.length) continue;
      const bank = node('section','answer-bank');
      const heading = node('div','bank-heading');
      heading.append(node('span','',group === 'diatonic' ? '順階和弦' : '變化和弦'),node('span','',`${chords.length} 個`));
      const grid = node('div','answer-grid'); grid.dataset.small = q.choices.length <= 3;
      for (const chord of chords) {
        const label = q.mode === 'chordToDegree' ? chord.roman : C.formatNote(chord.name);
        const button = node('button','choice-btn',label); button.type = 'button';
        button.dataset.answerId = chord.answerId; button.dataset.roman = chord.roman;
        button.setAttribute('aria-label',`選擇 ${label}`);
        button.addEventListener('click',() => answer(chord));
        grid.append(button);
      }
      bank.append(heading,grid); groups.push(bank);
    }
    $('choicesGrid').replaceChildren(...groups);
    $('timerArea').hidden = !session.timerEnabled;
    $('qText').setAttribute('tabindex','-1'); $('qText').focus({preventScroll:true});
    window.scrollTo(0,0);
    if (session.timerEnabled && !dialog.open) startClock();
  }
  function updateSessionStats() {
    text('scoreOk',session.ok); text('scoreBad',session.bad); text('streak',session.streak);
    $('roundProgress').setAttribute('aria-valuenow',session.answers.length);
    $('roundProgressFill').style.width = `${session.answers.length / session.questions.length * 100}%`;
  }
  function startClock() {
    clearClock();
    if (!session || session.phase !== 'question' || !session.timerEnabled) return;
    session.deadline = performance.now() + session.remaining;
    function tick() {
      if (!session || session.phase !== 'question') return;
      session.remaining = Math.max(0,session.deadline - performance.now());
      $('timerFill').style.transform = `scaleX(${session.remaining / (session.timerDuration * 1000)})`;
      text('timerLabel',`${Math.ceil(session.remaining / 1000)} 秒`);
      if (session.remaining <= 0) { answer(null,true); return; }
      clockHandle = setTimeout(tick,100);
    }
    tick();
  }
  function answer(selected,timedOut = false) {
    if (!session || session.phase !== 'question' || dialog.open) return;
    session.phase = 'feedback'; clearClock();
    const q = session.questions[session.index];
    const correct = C.isCorrect(selected,q.target);
    if (correct) { session.ok++; session.streak++; session.bestStreak = Math.max(session.bestStreak,session.streak); }
    else { session.bad++; session.streak = 0; }
    session.answers.push({question:q,selected,correct,timedOut});
    C.recordAnswer(progress,q,correct,session.kind === 'review'); saveProgress();
    updateSessionStats();
    $('choicesGrid').querySelectorAll('button').forEach(button => {
      button.disabled = true;
      if (button.dataset.answerId === q.target.answerId) { button.classList.add('correct'); button.setAttribute('aria-label',`${button.textContent}，正確答案`); }
      else if (selected && button.dataset.answerId === selected.answerId) { button.classList.add('wrong'); button.setAttribute('aria-label',`${button.textContent}，你的答案`); }
    });
    $('feedback').hidden = false; $('feedback').dataset.result = correct ? 'correct' : 'wrong';
    text('feedbackIcon',correct ? '✓' : '↻');
    text('feedbackTitle',`${correct ? '答對了！' : timedOut ? '時間到。正解：' : '正確答案：'}${q.target.roman} · ${C.formatNote(q.target.name)}`);
    text('selectedAnswer',selected ? `你選了 ${selected.roman} · ${C.formatNote(selected.name)}` : '這題未在時間內作答，已記入錯題。');
    const info = C.explanation(q,selected);
    for (const [id,key] of Object.entries({explanationLocation:'location',explanationQuality:'quality',explanationContrast:'contrast',minorNote:'minorNote'})) { text(id,info[key]); $(id).hidden = !info[key]; }
    $('answerDetails').open = !correct;
    text('scaleReferenceLabel',`${C.formatNote(q.key)} ${C.scaleLabel(q.scaleType)}的順階對照`);
    const triads = C.catalog(q.key,q.scaleType);
    $('scaleReferenceNotes').replaceChildren(...C.scaleNotes(q.key,q.scaleType).map((note,i) => { const cell = node('div','scale-note'); cell.append(node('strong','',C.formatNote(note)),node('small','',triads[i].roman)); return cell; }));
    const record = progress.review[C.reviewId(q)];
    text('reviewOutcome',!correct ? '這題已收進錯題複習，之後可以再練。' : session.kind === 'review' && record ? record.correctStreak >= 2 ? '已連續答對 2 次！這題已移出待複習。' : '複習連答 1 / 2，再答對一次就能移出待複習。' : '');
    $('reviewOutcome').hidden = !$('reviewOutcome').textContent;
    text('nextButton',session.index + 1 === session.questions.length ? '查看本回合結果 →' : '下一題 →');
    $('replayBtn').hidden = !settings.audioEnabled;
    if (settings.audioEnabled) AudioEngine.play(q.target);
    text('answerAnnouncement',`${$('feedbackTitle').textContent}。${!correct ? info.location + info.quality : ''}`);
    $('nextButton').focus({preventScroll:true});
    $('feedback').scrollIntoView({block:'nearest',behavior:'auto'});
  }
  function next() {
    if (!session || session.phase !== 'feedback' || dialog.open) return;
    if (session.index + 1 === session.questions.length) finishRound();
    else { session.index++; renderQuestion(); }
  }
  function finishRound() {
    if (!session || session.phase !== 'feedback') return;
    clearClock(); session.phase = 'summary';
    const accuracy = Math.round(session.ok / session.questions.length * 100);
    if (session.kind === 'guided') { C.recordLesson(progress,session.lessonId,session.ok,session.questions.length); saveProgress(); }
    $('practiceView').hidden = true; $('summaryView').hidden = false;
    text('summaryEyebrow',session.kind === 'review' ? '錯題複習完成' : session.kind === 'guided' ? '引導單元完成' : '這一回合完成了');
    text('summaryTitle',session.kind === 'guided' ? C.LESSONS.find(l => l.id === session.lessonId).title : '把剛剛練的，再記牢一點。');
    text('summaryAccuracy',`${accuracy}%`); text('summaryOk',session.ok); text('summaryBad',session.bad); text('summaryStreak',session.bestStreak);
    text('summaryMessage',session.kind === 'guided' ? accuracy >= 80 ? '已完成這個單元！接著換一個範圍試試。' : '答對 8 / 10 題就能完成。先看懂錯題，再練一次。' : session.kind === 'review' ? pending().length ? `還有 ${pending().length} 個級數待複習，可以接著練。` : '待複習的錯題都已連續答對 2 次。把這份熟悉帶到下一次練習。' : session.bad ? '把這次不熟的地方，留給下一輪慢慢練。' : '這回合全部答對！可以試試不同的調性。');
    const mistakes = session.answers.filter(a => !a.correct);
    $('summaryMistakes').replaceChildren(...mistakes.map(item => {
      const row = node('div','summary-mistake');
      const q = item.question;
      row.append(node('strong','',`${C.formatNote(q.key)} ${C.scaleLabel(q.scaleType)} · ${C.formatNote(q.target.name)} → ${q.target.roman}`));
      row.append(node('div','',item.timedOut ? '時間到，未作答' : `你選了 ${item.selected.roman} · ${C.formatNote(item.selected.name)}`));
      return row;
    }));
    const finished = session;
    if (session.kind === 'guided') {
      const following = C.LESSONS[C.LESSONS.findIndex(l => l.id === session.lessonId) + 1];
      text('summaryPrimary',accuracy >= 80 && following ? `下一單元：${following.title}` : accuracy >= 80 ? '回引導練習，查看進度' : '再練這個單元');
      $('summaryPrimary').onclick = () => accuracy >= 80 ? following ? startLesson(following) : navigate('guided') : startLesson(C.LESSONS.find(l => l.id === finished.lessonId));
    } else if (session.kind === 'review') {
      text('summaryPrimary',pending().length ? '繼續複習' : '回到引導練習');
      $('summaryPrimary').onclick = () => pending().length ? startReview() : navigate('guided');
    } else { text('summaryPrimary','再練 10 題'); $('summaryPrimary').onclick = () => startSession('custom',finished.config); }
    $('summaryReview').hidden = !pending().length || session.kind === 'review';
    text('summaryReview',`複習錯題（${pending().length} 個級數）`);
    $('summaryTitle').focus({preventScroll:true}); window.scrollTo(0,0);
  }
  const AudioEngine = {
    context:null,
    play(chord) {
      try {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        if (!this.context) this.context = new Context();
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
        const root = 261.625565 * Math.pow(2,C.pitch(chord.root) / 12);
        const intervals = chord.quality === 'dim' ? [0,3,6] : chord.quality === 'min' ? [0,3,7] : [0,4,7];
        for (const interval of intervals) {
          const osc = this.context.createOscillator(), gain = this.context.createGain();
          const now = this.context.currentTime;
          osc.type = 'triangle'; osc.frequency.value = root * Math.pow(2,interval / 12);
          osc.connect(gain); gain.connect(this.context.destination);
          gain.gain.setValueAtTime(0,now); gain.gain.linearRampToValueAtTime(.1,now + .025); gain.gain.exponentialRampToValueAtTime(.001,now + .8);
          osc.onended = () => { osc.disconnect(); gain.disconnect(); };
          osc.start(now); osc.stop(now + .85);
        }
      } catch (_) { /* Audio is optional; answer handling must remain usable. */ }
    }
  };
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click',() => navigate(button.dataset.view)));
  document.querySelector('.brand').addEventListener('click',event => { event.preventDefault(); navigate('guided'); });
  $('homeReviewButton').onclick = () => navigate('review');
  $('startReview').onclick = startReview; $('summaryReview').onclick = startReview;
  $('leaveSession').onclick = () => navigate(activeView);
  $('summaryHome').onclick = () => navigate(activeView);
  $('nextButton').onclick = next;
  $('replayBtn').onclick = () => { if (session?.phase === 'feedback' && settings.audioEnabled) AudioEngine.play(session.questions[session.index].target); };
  for (const [id,key] of Object.entries({modeSelect:'mode',keymodeSelect:'keymode',answerScopeSelect:'answerScope'})) $(id).addEventListener('change',event => {
    settings[key] = event.target.value; saveSettings();
    $('rootSelect').disabled = settings.keymode === 'random'; updateFilterCount();
  });
  $('rootSelect').addEventListener('change',event => { settings.root = event.target.value; saveSettings(); });
  $('scaleSelect').addEventListener('change',event => {
    settings.scaleType = event.target.value; settings.root = settings.scaleType === 'minor' ? 'A' : 'C';
    settings.selectedRomans = null; renderCustom(); saveSettings();
  });
  $('chordSetSelect').addEventListener('change',event => { settings.chordSet = event.target.value; settings.selectedRomans = null; renderFilters(); saveSettings(); });
  $('allFilter').onclick = () => { settings.selectedRomans = C.catalog(settings.root,settings.scaleType,settings.chordSet).map(c => c.roman); renderFilters(); saveSettings(); };
  $('commonFilter').onclick = () => { settings.selectedRomans = settings.scaleType === 'minor' ? ['i','iv','v','♭VI'] : ['I','IV','V','vi']; renderFilters(); saveSettings(); };
  $('customForm').addEventListener('submit',event => {
    event.preventDefault();
    if (settings.selectedRomans.length < 2) { updateFilterCount(); return; }
    saveSettings(); startSession('custom',{...settings,selectedRomans:settings.selectedRomans.slice()});
  });
  $('settingsButton').onclick = () => {
    if (session?.phase === 'question' && session.timerEnabled) { session.remaining = Math.max(0,session.deadline - performance.now()); clearClock(); }
    $('audioCheck').checked = settings.audioEnabled; $('timerCheck').checked = settings.timerEnabled;
    $('timerSeconds').value = settings.timerDuration; $('timerSetting').hidden = !settings.timerEnabled;
    dialog.showModal();
  };
  $('timerCheck').addEventListener('change',event => { $('timerSetting').hidden = !event.target.checked; });
  dialog.addEventListener('close',() => {
    settings.audioEnabled = $('audioCheck').checked; settings.timerEnabled = $('timerCheck').checked;
    const duration = Number($('timerSeconds').value);
    if (Number.isInteger(duration) && duration >= 1 && duration <= 60) settings.timerDuration = duration;
    saveSettings();
    if (session?.phase === 'feedback') $('replayBtn').hidden = !settings.audioEnabled;
    if (session?.phase === 'question' && session.timerEnabled) startClock();
  });
  document.addEventListener('keydown',event => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || dialog.open || /^(INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(event.target.tagName) || !session) return;
    if (session.phase === 'question' && /^[1-9]$/.test(event.key)) {
      const button = $('choicesGrid').querySelectorAll('button')[Number(event.key) - 1];
      if (button) { event.preventDefault(); button.click(); }
    } else if (event.key === 'Enter' && session.phase === 'feedback' && (event.target === document.body || event.target === $('qText'))) { event.preventDefault(); next(); }
  });
  navigate(['guided','custom','review'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'guided',false);
})();
