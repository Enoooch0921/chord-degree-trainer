const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../trainer.js');

test('C major contains the expected seven triads and advanced fifteen',() => {
  assert.deepEqual(C.catalog('C').map(c => c.name),['C','Dm','Em','F','G','Am','B°']);
  assert.equal(C.catalog('C','major','advanced').length,15);
});
test('regression: C minor advanced removes duplicate iv, v, bVI and bVII',() => {
  const all = C.catalog('C','minor','advanced');
  assert.equal(all.length,11);
  for (const roman of ['iv','v','♭VI','♭VII']) assert.equal(all.filter(c => c.roman === roman).length,1);
  const fm = all.find(c => c.roman === 'iv');
  assert.equal(fm.name,'Fm');
  assert.ok(C.isCorrect({...fm},fm),'Answer identity must not depend on array position or object identity');
  assert.ok(!C.isCorrect(all.find(c => c.roman === 'III'),fm));
});
test('every major/minor key has unique answer identities and correct diatonic pitches',() => {
  for (const [type,keys] of [['major',C.MAJOR_KEYS],['minor',C.MINOR_KEYS]]) {
    for (const key of keys) {
      const basic = C.catalog(key,type);
      const all = C.catalog(key,type,'advanced');
      assert.equal(new Set(all.map(c => c.answerId)).size,all.length,`${key} ${type}`);
      assert.equal(new Set(all.map(c => c.roman)).size,all.length);
      assert.deepEqual(basic.map(c => c.root),C.scaleNotes(key,type));
      assert.ok(all.every(c => Number.isFinite(C.pitch(c.root))));
    }
  }
});
test('key spelling includes flat, sharp and double-accidental notes',() => {
  assert.deepEqual(C.scaleNotes('Cb'),['Cb','Db','Eb','Fb','Gb','Ab','Bb']);
  assert.deepEqual(C.scaleNotes('A#','minor'),['A#','B#','C#','D#','E#','F#','G#']);
  assert.equal(C.catalog('Cb','major','advanced').find(c => c.roman === '♭VI').root,'Abb');
  assert.equal(C.pitch('Fb'),C.pitch('E'));
});
test('answer explanation distinguishes a major third from a minor triad',() => {
  const q = C.makeQuestion({scaleType:'major',chordSet:'advanced',answerScope:'full'},'C','iii');
  const info = C.explanation(q,q.choices.find(c => c.roman === 'III'));
  assert.match(info.location,/第 3 音/);
  assert.match(info.quality,/小三和弦.*小寫.*iii/);
  assert.match(info.contrast,/III.*E（大三和弦）/);
  const minor = C.makeQuestion({scaleType:'minor',chordSet:'advanced',answerScope:'full'},'A','♭III');
  assert.match(C.explanation(minor).location,/C♯.*降低.*C/);
  assert.match(C.explanation(minor).minorNote,/同主音大調/);
});
test('each lesson creates ten valid, balanced questions without consecutive identical questions',() => {
  for (const lesson of C.LESSONS) {
    const deck = C.buildRound(C.lessonConfig(lesson),10,() => .25);
    assert.equal(deck.length,10);
    assert.ok(deck.every(q => q.choices.some(c => C.isCorrect(c,q.target))));
    for (let i = 1; i < deck.length; i++) assert.notEqual(C.reviewId(deck[i]),C.reviewId(deck[i-1]));
    if (lesson.romans) assert.ok(deck.every(q => q.choices.every(c => lesson.romans.includes(c.roman))));
  }
});
test('filter can limit targets while retaining all distractors, in both directions',() => {
  for (const mode of ['chordToDegree','degreeToChord']) {
    const config = {...C.DEFAULTS,mode,chordSet:'advanced',selectedRomans:['I','IV'],answerScope:'full'};
    const deck = C.buildRound(config);
    assert.ok(deck.every(q => ['I','IV'].includes(q.target.roman) && q.choices.length === 15 && q.mode === mode));
    config.answerScope = 'selected';
    assert.ok(C.buildRound(config).every(q => q.choices.length === 2));
  }
});
test('invalid settings and old stored filters migrate to available major/minor choices',() => {
  const old = C.normalizeSettings({scaleType:'minor',root:'Cb',chordSet:'advanced',degreeFilter:[0,3],chromaFilter:['iv','♭VII'],timerDuration:-5});
  assert.equal(old.root,'A');
  assert.equal(old.timerDuration,5);
  assert.deepEqual(old.selectedRomans,['i','iv','♭VII']);
  assert.equal(C.normalizeSettings({mode:'anything',audioEnabled:'false'}).mode,'chordToDegree');
  assert.equal(C.normalizeSettings({audioEnabled:'false'}).audioEnabled,true);
  assert.throws(() => C.buildRound({...C.DEFAULTS,selectedRomans:[]}),/至少/);
});
test('wrong answers persist and review retains key, scale and direction',() => {
  const progress = C.emptyProgress();
  const q = C.makeQuestion({scaleType:'minor',mode:'degreeToChord',chordSet:'advanced',answerScope:'full'},'D','iv');
  C.recordAnswer(progress,q,false,false,123);
  const restored = C.normalizeProgress(JSON.parse(JSON.stringify(progress)));
  assert.equal(C.pendingReviews(restored).length,1);
  const deck = C.buildReviewRound(restored);
  assert.equal(deck.length,2);
  assert.ok(deck.every(item => item.key === 'D' && item.scaleType === 'minor' && item.mode === 'degreeToChord' && item.target.roman === 'iv'));
  assert.ok(deck.every(item => item.choices.length === 11));
});
test('only two consecutive correct review answers resolve a mistake; a relapse resets it',() => {
  const progress = C.emptyProgress();
  const q = C.makeQuestion({scaleType:'major',answerScope:'full'},'C','V');
  C.recordAnswer(progress,q,false);
  C.recordAnswer(progress,q,true,false);
  assert.equal(progress.review[C.reviewId(q)].correctStreak,0);
  C.recordAnswer(progress,q,true,true);
  assert.equal(C.pendingReviews(progress).length,1);
  C.recordAnswer(progress,q,false,true);
  assert.equal(progress.review[C.reviewId(q)].correctStreak,0);
  C.recordAnswer(progress,q,true,true);
  C.recordAnswer(progress,q,true,true);
  assert.equal(C.pendingReviews(progress).length,0);
  assert.equal(C.buildReviewRound(progress).length,0);
  C.recordAnswer(progress,q,false);
  assert.equal(C.pendingReviews(progress).length,1);
});
test('review queue is bounded to ten and one remaining success needs one question',() => {
  const progress = C.emptyProgress();
  const q = C.makeQuestion({scaleType:'major',answerScope:'full'},'C','I');
  C.recordAnswer(progress,q,false); C.recordAnswer(progress,q,true,true);
  assert.equal(C.buildReviewRound(progress).length,1);
  for (const key of C.MAJOR_KEYS) {
    for (const roman of ['I','V']) C.recordAnswer(progress,C.makeQuestion({scaleType:'major',answerScope:'full'},key,roman),false);
  }
  assert.equal(C.buildReviewRound(progress).length,10);
});
test('lesson completion requires 80 percent and survives a later weaker round',() => {
  const progress = C.emptyProgress();
  const id = C.LESSONS[0].id;
  C.recordLesson(progress,id,7,10); assert.equal(progress.lessons[id].completed,false);
  C.recordLesson(progress,id,8,10); assert.equal(progress.lessons[id].completed,true);
  C.recordLesson(progress,id,3,10); assert.equal(progress.lessons[id].bestAccuracy,80);
  assert.equal(progress.lessons[id].attempts,3);
  assert.equal(C.normalizeProgress(JSON.parse(JSON.stringify(progress))).lessons[id].completed,true);
});
test('corrupt stored progress cannot introduce invalid review targets or unlock lessons',() => {
  const progress = C.normalizeProgress({version:1,review:{bad:{key:'not-a-key',roman:'I'},alsoBad:{key:'C',scaleType:'major',mode:'chordToDegree',roman:'invalid'}},lessons:{'first-three':{bestAccuracy:-20,completed:true}}});
  assert.equal(C.pendingReviews(progress).length,0);
  assert.equal(progress.lessons['first-three'].completed,false);
  assert.deepEqual(C.normalizeProgress(null),C.emptyProgress());
});
