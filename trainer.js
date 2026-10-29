/* Shared music and learning rules. No browser or third-party dependencies. */
(function (scope, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else scope.ChordTrainer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAJOR_KEYS = ['C','G','D','A','E','B','F#','C#','F','Bb','Eb','Ab','Db','Gb','Cb'];
  const MINOR_KEYS = ['A','E','B','F#','C#','G#','D#','A#','D','G','C','F','Bb','Eb','Ab'];
  const LETTERS = ['C','D','E','F','G','A','B'];
  const NATURAL = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  const MAJOR_INTERVALS = [0,2,4,5,7,9,11];
  const MINOR_INTERVALS = [0,2,3,5,7,8,10];
  const MAJOR = [
    ['I',0,0,'maj'],['ii',1,0,'min'],['iii',2,0,'min'],['IV',3,0,'maj'],
    ['V',4,0,'maj'],['vi',5,0,'min'],['vii°',6,0,'dim']
  ];
  const MINOR = [
    ['i',0,0,'min'],['ii°',1,0,'dim'],['♭III',2,-1,'maj'],['iv',3,0,'min'],
    ['v',4,0,'min'],['♭VI',5,-1,'maj'],['♭VII',6,-1,'maj']
  ];
  const EXTRA = [
    ['II',1,0,'maj'],['III',2,0,'maj'],['iv',3,0,'min'],['v',4,0,'min'],
    ['VI',5,0,'maj'],['♯IV°',3,1,'dim'],['♭VI',5,-1,'maj'],['♭VII',6,-1,'maj']
  ];
  const QUALITY = { maj:'大三和弦', min:'小三和弦', dim:'減三和弦' };
  const LESSONS = [
    { id:'first-three', title:'先認識 I、IV、V', description:'固定 C 大調，先抓穩三個常用級數。', tag:'起步', key:'C', scaleType:'major', romans:['I','IV','V'] },
    { id:'add-six', title:'加入小和弦 vi', description:'練習 I、IV、V、vi，分辨大、小三和弦。', tag:'常用和弦', key:'C', scaleType:'major', romans:['I','IV','V','vi'] },
    { id:'all-seven', title:'補齊七個順階和弦', description:'認識 ii、iii 與 vii° 在 C 大調的位置。', tag:'順階', key:'C', scaleType:'major' },
    { id:'new-key', title:'把熟悉的級數帶到 G 大調', description:'換一個主音，練習相同的七級關係。', tag:'換調', key:'G', scaleType:'major' },
    { id:'across-keys', title:'跨調辨認', description:'在 C、G、D、F、B♭ 大調之間切換。', tag:'活用', keys:['C','G','D','F','Bb'], scaleType:'major' },
    { id:'minor-world', title:'認識自然小調', description:'從 A 自然小調開始，認識 i 與 ♭III 等級數。', tag:'小調', key:'A', scaleType:'minor' },
    { id:'color-chords', title:'加入變化和弦', description:'在 C 大調辨認 iv、♭VI 與其他變化和弦。', tag:'進階', key:'C', scaleType:'major', chordSet:'advanced' }
  ];
  const DEFAULTS = { mode:'chordToDegree', root:'C', scaleType:'major', keymode:'fixed', chordSet:'diatonic', selectedRomans:null, answerScope:'selected', audioEnabled:true, timerEnabled:false, timerDuration:5 };
  const mod = n => ((n % 12) + 12) % 12;
  const formatNote = note => String(note).replace(/b/g,'♭').replace(/#/g,'♯');
  const scaleLabel = scale => scale === 'minor' ? '自然小調' : '大調';
  function pitch(note) {
    if (typeof note !== 'string' || !/^[A-G][#b]*$/.test(note)) throw new Error('Invalid note');
    return mod(NATURAL[note[0]] + [...note.slice(1)].reduce((n,a) => n + (a === '#' ? 1 : -1),0));
  }
  function spelledNote(key, degree, interval) {
    const letter = LETTERS[(LETTERS.indexOf(key[0]) + degree) % 7];
    let difference = mod(pitch(key) + interval - NATURAL[letter]);
    if (difference > 6) difference -= 12;
    return letter + (difference >= 0 ? '#'.repeat(difference) : 'b'.repeat(-difference));
  }
  function scaleNotes(key, type = 'major') {
    return (type === 'minor' ? MINOR_INTERVALS : MAJOR_INTERVALS).map((interval,i) => spelledNote(key,i,interval));
  }
  function chordFromSpec(key, spec, group) {
    const [roman,degree,alteration,quality] = spec;
    const root = spelledNote(key,degree,MAJOR_INTERVALS[degree] + alteration);
    return { roman, degree, alteration, quality, root, name:root + (quality === 'min' ? 'm' : quality === 'dim' ? '°' : ''), answerId:`${pitch(root)}:${quality}`, group };
  }
  function catalog(key, type = 'major', set = 'diatonic') {
    const base = (type === 'minor' ? MINOR : MAJOR).map(s => chordFromSpec(key,s,'diatonic'));
    const chords = set === 'advanced' ? [...base,...EXTRA.map(s => chordFromSpec(key,s,'chromatic'))] : base;
    const seen = new Set();
    return chords.filter(chord => {
      if (seen.has(chord.answerId)) return false;
      seen.add(chord.answerId);
      return true;
    });
  }
  function isCorrect(answer, target) {
    return Boolean(answer && target && answer.answerId === target.answerId);
  }
  function explanation(question, selected) {
    const target = question.target;
    const original = spelledNote(question.key,target.degree,MAJOR_INTERVALS[target.degree]);
    const location = target.alteration === 0
      ? `${formatNote(target.root)} 是以 ${formatNote(question.key)} 為主音的第 ${target.degree + 1} 音。`
      : `${formatNote(question.key)} 大調的第 ${target.degree + 1} 音是 ${formatNote(original)}，${target.alteration < 0 ? '降低' : '升高'}半音得到 ${formatNote(target.root)}，級數前加 ${target.alteration < 0 ? '♭' : '♯'}。`;
    const quality = target.quality === 'maj' ? '大三和弦用大寫羅馬數字' : target.quality === 'min' ? '小三和弦用小寫羅馬數字' : '減三和弦用小寫羅馬數字，再加上 °';
    const contrast = selected && !isCorrect(selected,target)
      ? `你選的 ${selected.roman} 對應 ${formatNote(selected.name)}（${QUALITY[selected.quality]}）。`
      : '';
    return { location, quality:`${formatNote(target.name)} 是${QUALITY[target.quality]}；${quality}，因此答案是 ${target.roman}。`, contrast, minorNote:question.scaleType === 'minor' ? '小調的 ♭III、♭VI、♭VII，採同主音大調作為升降級數的基準。' : '' };
  }
  function normalizeSettings(raw = {}) {
    const s = { ...DEFAULTS };
    for (const [key,allowed] of Object.entries({mode:['chordToDegree','degreeToChord'],scaleType:['major','minor'],keymode:['fixed','random'],chordSet:['diatonic','advanced'],answerScope:['selected','full']})) {
      if (allowed.includes(raw[key])) s[key] = raw[key];
    }
    const keys = s.scaleType === 'minor' ? MINOR_KEYS : MAJOR_KEYS;
    s.root = keys.includes(raw.root) ? raw.root : s.scaleType === 'minor' ? 'A' : 'C';
    for (const key of ['audioEnabled','timerEnabled']) if (typeof raw[key] === 'boolean') s[key] = raw[key];
    if (Number.isInteger(raw.timerDuration) && raw.timerDuration >= 1 && raw.timerDuration <= 60) s.timerDuration = raw.timerDuration;
    const valid = catalog(s.root,s.scaleType,s.chordSet).map(c => c.roman);
    if (Array.isArray(raw.selectedRomans)) s.selectedRomans = [...new Set(raw.selectedRomans.filter(r => valid.includes(r)))];
    else if (Array.isArray(raw.degreeFilter)) {
      const basics = (s.scaleType === 'minor' ? MINOR : MAJOR).map(c => c[0]);
      s.selectedRomans = [...new Set([...raw.degreeFilter.filter(i => Number.isInteger(i) && i >= 0 && i < 7).map(i => basics[i]),...(Array.isArray(raw.chromaFilter) ? raw.chromaFilter : [])])].filter(r => valid.includes(r));
    }
    if (!s.selectedRomans || !s.selectedRomans.length) s.selectedRomans = valid;
    return s;
  }
  function shuffled(values, random = Math.random) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i],result[j]] = [result[j],result[i]]; }
    return result;
  }
  function makeQuestion(config, key, roman) {
    const all = catalog(key,config.scaleType,config.chordSet || 'diatonic');
    const selected = config.selectedRomans || all.map(c => c.roman);
    const choices = config.answerScope === 'full' ? all : all.filter(c => selected.includes(c.roman));
    const target = choices.find(c => c.roman === roman);
    if (!target) throw new Error('Question target is missing from choices');
    return { key, scaleType:config.scaleType, mode:config.mode || 'chordToDegree', target, choices };
  }
  function buildRound(config, size = 10, random = Math.random) {
    const keys = config.keys || (config.keymode === 'random' ? (config.scaleType === 'minor' ? MINOR_KEYS : MAJOR_KEYS) : [config.root]);
    const pool = keys.flatMap(key => catalog(key,config.scaleType,config.chordSet).filter(c => !config.selectedRomans || config.selectedRomans.includes(c.roman)).map(c => ({key,roman:c.roman})));
    if (pool.length < 2) throw new Error('請至少選擇兩個級數');
    const deck = [];
    while (deck.length < size) {
      const batch = shuffled(pool,random);
      if (deck.length && batch.length > 1 && batch[0].roman === deck[deck.length-1].roman && batch[0].key === deck[deck.length-1].key) [batch[0],batch[1]] = [batch[1],batch[0]];
      deck.push(...batch);
    }
    return deck.slice(0,size).map(item => makeQuestion(config,item.key,item.roman));
  }
  function lessonConfig(lesson) {
    return { ...DEFAULTS, root:lesson.key || 'C', keys:lesson.keys, scaleType:lesson.scaleType, chordSet:lesson.chordSet || 'diatonic', selectedRomans:lesson.romans || null, answerScope:'selected' };
  }
  function reviewId(q) { return [q.key,q.scaleType,q.mode,q.target.roman].join('|'); }
  function emptyProgress() { return { version:1, review:{}, lessons:{} }; }
  function validRecord(value) {
    if (!value || !(value.scaleType === 'minor' ? MINOR_KEYS : MAJOR_KEYS).includes(value.key) || !['major','minor'].includes(value.scaleType) || !['chordToDegree','degreeToChord'].includes(value.mode)) return false;
    return catalog(value.key,value.scaleType,'advanced').some(c => c.roman === value.roman);
  }
  function normalizeProgress(raw) {
    const progress = emptyProgress();
    if (!raw || raw.version !== 1) return progress;
    for (const value of Object.values(raw.review || {})) {
      if (!validRecord(value)) continue;
      const record = { key:value.key, scaleType:value.scaleType, mode:value.mode, roman:value.roman, misses:Math.max(1,Number.isSafeInteger(value.misses) ? value.misses : 1), correctStreak:Math.min(2,Math.max(0,Number.isInteger(value.correctStreak) ? value.correctStreak : 0)), lastWrong:Number.isFinite(value.lastWrong) ? value.lastWrong : 0 };
      progress.review[[record.key,record.scaleType,record.mode,record.roman].join('|')] = record;
    }
    for (const lesson of LESSONS) {
      const value = raw.lessons && raw.lessons[lesson.id];
      if (value && Number.isFinite(value.bestAccuracy)) progress.lessons[lesson.id] = { bestAccuracy:Math.max(0,Math.min(100,value.bestAccuracy)), attempts:Math.max(1,Number.isSafeInteger(value.attempts) ? value.attempts : 1), completed:value.bestAccuracy >= 80 };
    }
    return progress;
  }
  const pendingReviews = progress => Object.values(progress.review).filter(r => r.correctStreak < 2).sort((a,b) => b.misses - a.misses || b.lastWrong - a.lastWrong);
  function recordAnswer(progress, question, correct, inReview = false, now = Date.now()) {
    const id = reviewId(question);
    if (!correct) {
      const old = progress.review[id];
      progress.review[id] = { key:question.key, scaleType:question.scaleType, mode:question.mode, roman:question.target.roman, misses:(old ? old.misses : 0) + 1, correctStreak:0, lastWrong:now };
    } else if (inReview && progress.review[id]) progress.review[id].correctStreak = Math.min(2,progress.review[id].correctStreak + 1);
  }
  function buildReviewRound(progress, size = 10, random = Math.random) {
    const entries = pendingReviews(progress);
    if (!entries.length) return [];
    const first = entries.slice(0,size);
    const second = shuffled(first.filter(r => r.correctStreak === 0),random);
    return [...first,...second].slice(0,size).map(r => makeQuestion({scaleType:r.scaleType,mode:r.mode,chordSet:'advanced',answerScope:'full'},r.key,r.roman));
  }
  function recordLesson(progress, id, correct, total) {
    if (!LESSONS.some(l => l.id === id) || total < 1) return;
    const accuracy = Math.round(correct / total * 100);
    const previous = progress.lessons[id];
    const bestAccuracy = Math.max(previous ? previous.bestAccuracy : 0,accuracy);
    progress.lessons[id] = { bestAccuracy, completed:bestAccuracy >= 80, attempts:(previous ? previous.attempts : 0) + 1 };
  }
  return { MAJOR_KEYS,MINOR_KEYS,LESSONS,DEFAULTS,QUALITY,pitch,formatNote,scaleLabel,scaleNotes,catalog,isCorrect,explanation,normalizeSettings,shuffled,makeQuestion,buildRound,lessonConfig,reviewId,emptyProgress,normalizeProgress,pendingReviews,recordAnswer,buildReviewRound,recordLesson };
});
