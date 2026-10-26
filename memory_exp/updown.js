// 上下法（実験1）と練習。手続き・タイミング・計算は2019年版（exp_updown.js / practice_updown.js）と同じ。
// 2026年版で加えたもの：途中からの再開（実験1のみ）、全角入力の防止、終了画面の予備ボタン。
// 使い方：<script>UpDown.run({ mode: 'exp' })</script> または mode: 'practice'
const UpDown = (() => {
  function run({ mode }) {
    const isPractice = mode === 'practice'
    // 実験のパラメータ（2019年版と同じ）
    const settings = isPractice ? { initialDifficulty: 4, trials: 10 } : { initialDifficulty: 4, series: 20 }
    const KEY = 'updown'
    const H = updownHelpers

    const stim = document.getElementById('stimulus')
    const input = document.getElementById('js-input-form')
    const warnEl = document.getElementById('warn')
    const result = document.getElementById('result')
    const resume = document.getElementById('resume')
    const guard = Core.guardInput(input, warnEl)

    const header = { trialNum: 'trialNum', seriesNum: 'series', seriesType: 'seriesType', progression: 'progression', response: 'response', numberOfDigits: 'numberOfDigits', correct: 'correct' }
    const fresh = () => ({ trialNum: 1, seriesType: 1, seriesNum: 1, numberOfDigits: settings.initialDifficulty, log: [header] })
    let st = fresh()
    let presentation = ''
    let readonly = true

    function setReadonly(ro) { readonly = ro; input.readOnly = ro }

    // 画面遷移（2019年版の actions と同じ時間）
    function startMemorize() {
      presentation = H.createProgression(st.numberOfDigits)
      stim.textContent = presentation; stim.style.visibility = 'visible'
      input.value = ''; setReadonly(true)
      setTimeout(endMemorize, 3000)
    }
    function endMemorize() {
      stim.style.visibility = 'hidden'
      setTimeout(startAnswer, 5000)
    }
    function startAnswer() {
      setReadonly(false); input.focus()
    }
    function submit() {
      if (readonly) return            // 保持時間中の入力は受け付けない
      guard.clearWarn()
      const response = input.value
      const correct = presentation == response   // 正解判定（2019年版と同じ）
      const latestTrialLog = {
        trialNum: st.trialNum, seriesNum: st.seriesNum, seriesType: st.seriesType,
        progression: presentation, response: response, numberOfDigits: st.numberOfDigits, correct: correct ? 1 : 0,
      }
      const nextSeriesType = H.switchSeriesType(st.log[st.log.length - 1], latestTrialLog)
      st = {
        ...st,
        trialNum: st.trialNum + 1,
        log: st.log.concat([latestTrialLog]),
        numberOfDigits: st.numberOfDigits + nextSeriesType,
        seriesType: nextSeriesType,
        seriesNum: st.seriesNum + (nextSeriesType != st.seriesType ? 1 : 0),
      }
      stim.textContent = correct ? 'correct' : 'incorrect'; stim.style.visibility = 'visible'
      setReadonly(true)
      if (isPractice) {
        if (st.trialNum > settings.trials) { stim.textContent = 'end'; result.innerHTML = '<pre>練習終わり</pre>'; return }
      } else {
        if (st.seriesNum > settings.series) { finish(); return }
        Core.save(KEY, { finished: false, st })   // 1試行ごとに保存（途中から再開できるように）
      }
      setTimeout(startMemorize, 3000)
    }

    function finish() {
      const memCap = H.separateIntoSeries(st.log).map(H.calcReprOfSeries).reduce((a, c) => a + c, 0) / settings.series
      const csv = H.createCSV(st.log.concat([{ trialNum: 'memCap', seriesNum: memCap }]))
      Core.save(KEY, { finished: true, csv, memCap })
      Core.save('memcap', memCap)     // 恒常法の範囲の確認に使う
      Core.download('updown.csv', csv)
      showEnd(csv, memCap)
    }
    function showEnd(csv, memCap) {
      stim.textContent = 'end'; stim.style.visibility = 'visible'; setReadonly(true)
      Core.showResult(result, 'updown.csv', csv, [`記憶範囲（memCap）：${memCap}　← 実験2で使うので、メモしてください`])
      Core.resetLink(result, KEY)
    }

    input.addEventListener('keydown', e => { if (Core.isSubmitKey(e, guard)) { e.preventDefault(); submit() } })

    if (isPractice) { startMemorize(); return }
    const saved = Core.load(KEY)
    if (saved && saved.finished) {
      showEnd(saved.csv, saved.memCap)
    } else if (saved && saved.st && saved.st.log.length > 1) {
      stim.textContent = ''
      Core.askResume(resume, saved.st.log.length - 1,
        () => { st = saved.st; startMemorize() },
        () => { Core.clear(KEY); st = fresh(); startMemorize() })
    } else {
      startMemorize()   // 2019年版と同じく、ページを開くとすぐに始まる
    }
  }
  return { run }
})()
