// 恒常法（実験2）。手続き・タイミング・試行順の作り方・CSV は2019年版（exp_constant.js）と同じ。
// 2026年版で加えたもの：範囲の入力のチェック、途中からの再開、全角入力の防止、終了画面の予備ボタン。
const Constant = (() => {
  // 実験1の記憶範囲から、正しい最小桁数・最大桁数を求める（インストラクションの決まり）
  function expectedRange(m) {
    const lo = Math.floor(m) - 2
    const hi = (Number.isInteger(m) ? m + 1 : Math.ceil(m)) + 2
    return { min: lo, max: hi }
  }
  function validate(conf, memCap) {
    const errs = []
    if ([conf.min, conf.max, conf.trialsPerDifficulty].some(v => !Number.isInteger(v))) {
      return ['すべての欄に、半角の整数を入力してください。']
    }
    if (typeof memCap === 'number' && isFinite(memCap)) {
      const ex = expectedRange(memCap)
      if (conf.min !== ex.min) errs.push(`最小桁数が正しくありません。実験1の記憶範囲（${memCap}）の小数点以下を切り捨てて、2を引いた値です。`)
      if (conf.max !== ex.max) errs.push(`最大桁数が正しくありません。実験1の記憶範囲（${memCap}）の小数点以下を切り上げて（整数のときは1を足して）、2を加えた値です。`)
    } else {
      if (conf.min < 1) errs.push('最小桁数は1以上にしてください。')
      if (conf.max - conf.min !== 5) errs.push('最大桁数と最小桁数の差が5（6段階）になるように入力してください。')
    }
    if (conf.trialsPerDifficulty !== 12) errs.push('各桁ごとの試行数は12です。')
    return errs
  }

  function run() {
    const KEY = 'constant'
    const H = constantHelpers
    const stim = document.getElementById('stimulus')
    const input = document.getElementById('js-input-form')
    const warnEl = document.getElementById('warn')
    const result = document.getElementById('result')
    const resume = document.getElementById('resume')
    const setup = document.getElementById('setup')
    const main = document.getElementById('main')
    const guard = Core.guardInput(input, warnEl)

    const header = { trialNum: 'trialNum', progression: 'progression', response: 'response', numberOfDigits: 'numberOfDigits', correct: 'correct' }
    let st = null
    let presentation = ''
    let readonly = true
    const memCap = Core.load('memcap')
    if (!(typeof memCap === 'number')) {
      document.getElementById('nomemcap').hidden = false
    }

    function setReadonly(ro) { readonly = ro; input.readOnly = ro }
    function startMemorize() {
      presentation = H.createProgression(st.difficultyList[st.trialNum - 1])
      stim.textContent = presentation; stim.style.visibility = 'visible'
      input.value = ''; setReadonly(true)
      setTimeout(endMemorize, 3000)
    }
    function endMemorize() { stim.style.visibility = 'hidden'; setTimeout(startAnswer, 5000) }
    function startAnswer() { setReadonly(false); input.focus() }
    function submit() {
      if (readonly) return
      guard.clearWarn()
      const response = input.value
      const correct = presentation == response
      const latestTrialLog = { trialNum: st.trialNum, progression: presentation, response: response, numberOfDigits: st.difficultyList[st.trialNum - 1], correct: correct ? 1 : 0 }
      st = { ...st, trialNum: st.trialNum + 1, log: st.log.concat([latestTrialLog]) }
      stim.textContent = correct ? 'correct' : 'incorrect'; stim.style.visibility = 'visible'
      setReadonly(true)
      if (st.trialNum > st.difficultyList.length) { finish(); return }
      Core.save(KEY, { finished: false, st })
      setTimeout(startMemorize, 3000)
    }
    function finish() {
      const csv = H.createCSV(st.log)
      Core.save(KEY, { finished: true, csv })
      Core.download('constant.csv', csv)
      showEnd(csv)
    }
    function showEnd(csv) {
      setup.hidden = true; main.hidden = false
      stim.textContent = 'end'; stim.style.visibility = 'visible'; setReadonly(true)
      Core.showResult(result, 'constant.csv', csv, [])
      Core.resetLink(result, KEY)
    }
    function begin(conf) {
      st = { conf, difficultyList: H.makeDifficultyList(conf), trialNum: 1, log: [header] }
      Core.save(KEY, { finished: false, st })
      setup.hidden = true; main.hidden = false
      setTimeout(startMemorize, 100)
    }

    document.getElementById('start').onclick = () => {
      const conf = {
        min: parseInt(document.getElementById('min').value),
        max: parseInt(document.getElementById('max').value),
        trialsPerDifficulty: parseInt(document.getElementById('trialsPerDifficulty').value),
      }
      const errs = validate(conf, typeof memCap === 'number' ? memCap : null)
      const box = document.getElementById('errors')
      box.innerHTML = ''
      if (errs.length) { for (const e of errs) { const li = document.createElement('li'); li.textContent = e; box.appendChild(li) } return }
      begin(conf)
    }
    input.addEventListener('keydown', e => { if (Core.isSubmitKey(e, guard)) { e.preventDefault(); submit() } })

    const saved = Core.load(KEY)
    if (saved && saved.finished) {
      showEnd(saved.csv)
    } else if (saved && saved.st && saved.st.log.length > 1) {
      setup.hidden = true
      Core.askResume(resume, saved.st.log.length - 1,
        () => { st = saved.st; main.hidden = false; startMemorize() },
        () => { Core.clear(KEY); setup.hidden = false })
    } else if (saved && saved.st) {
      Core.clear(KEY)    // 設定だけして1試行も答えていない記録は捨てて、設定からやり直す
    }
  }
  return { run, validate, expectedRange }
})()
