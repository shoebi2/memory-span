// 3つのページ（練習・上下法・恒常法）で共通の部品。
// 2026年版で加えたもの：途中からの再開（localStorage）、全角・日本語入力の防止、ダウンロードの予備ボタン。
const Core = (() => {
  // 保存の名前の頭に付ける文字列。同じドメイン（例：xxx.github.io）の別のサイトと混ざらないようにするため
  const NS = 'enshu-memspan-2026:'

  function load(key) {
    try { const s = localStorage.getItem(NS + key); return s ? JSON.parse(s) : null } catch (e) { return null }
  }
  function save(key, obj) {
    try { localStorage.setItem(NS + key, JSON.stringify(obj)); return true } catch (e) { return false }
  }
  function clear(key) {
    try { localStorage.removeItem(NS + key) } catch (e) { }
  }

  // 2019年版と同じ方法でダウンロードする（Blob に種類を付けない、ファイル名は固定）
  function download(name, text) {
    const blob = new Blob([text])
    const a = document.createElement('a')
    a.setAttribute('download', name)
    a.href = URL.createObjectURL(blob)
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 2000)
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true } catch (e) { }
    try {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
      const ok = document.execCommand('copy'); ta.remove(); return ok
    } catch (e) { return false }
  }

  // 回答欄：半角数字だけを受け付ける。日本語入力（変換中）を検知したら注意を出し、確定した全角文字は消す
  function guardInput(input, warnEl) {
    let composing = false
    const warn = () => { warnEl.textContent = '半角数字で入力してください（日本語入力をオフにしてください）' }
    input.addEventListener('compositionstart', () => { composing = true; warn() })
    input.addEventListener('compositionend', () => { composing = false; sanitize() })
    input.addEventListener('input', () => { if (!composing) sanitize() })
    function sanitize() {
      const v = input.value, c = v.replace(/[^0-9]/g, '')
      if (c !== v) { input.value = c; warn() }
    }
    return { isComposing: () => composing, clearWarn: () => { warnEl.textContent = '' } }
  }

  // Enter（Return）キーで回答を確定するときの判定。日本語入力の確定の Enter は回答にしない
  function isSubmitKey(e, guard) {
    if (e.key !== 'Enter' && e.keyCode !== 13) return false
    if (e.isComposing || e.keyCode === 229 || guard.isComposing()) return false
    return true
  }

  // 終了画面：結果の表示と、保存・コピーの予備ボタン
  function showResult(container, fileName, csv, extraLines) {
    container.innerHTML = ''
    const msg = document.createElement('p')
    msg.textContent = '実験が終わりました。以下の結果と同じものが自動でダウンロードされたので確認してください。'
    container.appendChild(msg)
    for (const line of (extraLines || [])) {
      const p = document.createElement('p'); p.className = 'strong'; p.textContent = line; container.appendChild(p)
    }
    const row = document.createElement('p')
    const b1 = document.createElement('button'); b1.textContent = `${fileName} をもう一度保存する`
    b1.onclick = () => download(fileName, csv)
    const b2 = document.createElement('button'); b2.textContent = '結果をコピーする'
    const note = document.createElement('span'); note.className = 'note'
    b2.onclick = async () => { note.textContent = (await copy(csv)) ? '　コピーしました' : '　コピーできませんでした。下の結果を選択してコピーしてください' }
    row.append(b1, ' ', b2, note); container.appendChild(row)
    const pre = document.createElement('pre'); pre.textContent = csv; container.appendChild(pre)
  }

  // 途中の記録があるときの確認画面
  function askResume(panel, doneTrials, onResume, onRestart) {
    panel.hidden = false
    panel.innerHTML = ''
    const p = document.createElement('p'); p.className = 'strong'
    p.textContent = `前回の続きがあります（${doneTrials}試行目まで回答済み）。`
    const p2 = document.createElement('p')
    p2.textContent = '「続きから再開」を押すと、次の試行から始まります（回答していなかった試行は、新しい数字列でやり直します）。'
    const b1 = document.createElement('button'); b1.textContent = '続きから再開'; b1.className = 'primary'
    const b2 = document.createElement('button'); b2.textContent = '最初からやり直す（これまでの記録は消えます）'
    b1.onclick = () => { panel.hidden = true; onResume() }
    b2.onclick = () => { if (confirm('これまでの記録を消して、最初からやり直しますか？')) { panel.hidden = true; onRestart() } }
    panel.append(p, p2, b1, ' ', b2)
  }

  // 終わった実験をもう一度開いたときに、記録を消してやり直すためのリンク
  function resetLink(container, key) {
    const a = document.createElement('a'); a.href = '#'; a.className = 'reset'
    a.textContent = '記録を消して最初からやり直す'
    a.onclick = e => { e.preventDefault(); if (confirm('この実験の記録を消して、最初からやり直しますか？（ダウンロード済みのファイルは消えません）')) { clear(key); location.reload() } }
    container.appendChild(a)
  }

  return { load, save, clear, download, copy, guardInput, isSubmitKey, showResult, askResume, resetLink }
})()
