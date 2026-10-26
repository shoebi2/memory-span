// 2026年版と2019年版を、同じ回答の並びで動かして結果を照合し、2026年版で加えた機能を確かめる。
//   npm i playwright && npx playwright install chromium firefox webkit
//   node tests/compare_with_2019.js            （リポジトリの一番上で実行）
// 照合：試行番号・系列・系列の方向・桁数・正誤・memCap の行・CSV の見出しが2019年版と一致すること。
const pw = require('playwright')
const http = require('http'), fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..')
const PORT = 8790
const srv = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]))
  if (f.endsWith('/')) f += 'index.html'
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end() }
  const t = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream'
  r.writeHead(200, { 'Content-Type': t }); fs.createReadStream(f).pipe(r)
}).listen(PORT)
const BASE = `http://localhost:${PORT}/`
const OLD = BASE + 'original_2019/memory_exp/', NEW = BASE + 'memory_exp/'

// 決まった回答をする模擬の参加者：正誤は「試行番号と桁数」だけで決まる（両方の版で同じ並びになる）
function hash(a, b) { let x = (a * 2654435761 + b * 40503) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296 }
function decide(trial, digits, cap) { const p = 1 / (1 + Math.exp((digits - cap) / 0.8)); return hash(trial, digits) < p }
const wrong = s => s.slice(0, -1) + ((+s.slice(-1) + 1) % 10)

async function waitDigits(page) {
  for (let i = 0; i < 300; i++) {
    const v = await page.evaluate(() => { const h = document.querySelector('h2'); return h ? h.textContent : null })
    if (v && /^\d+$/.test(v)) return v
    if (v === 'end') return 'end'
    await page.clock.runFor(10)
  }
  throw new Error('stimulus did not appear')
}

async function runTrials(page, cap, maxTrials) {
  let t = 0
  for (; t < maxTrials; t++) {
    const s = await waitDigits(page); if (s === 'end') break
    await page.clock.runFor(8000)
    const ans = decide(t + 1, s.length, cap) ? s : wrong(s)
    await page.fill('#js-input-form', ans); await page.keyboard.press('Enter'); await page.clock.runFor(20)
    if ((await page.textContent('h2')) === 'end') { t++; break }
    await page.clock.runFor(2980)
  }
  return t
}

function cols(csv, idx) { return csv.trim().split(/\r?\n/).map(r => r.split(',')).map(r => idx.map(i => r[i]).join(',')) }

const results = []
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); }

;(async () => {
  for (const bname of ['chromium', 'firefox', 'webkit']) {
    const browser = await pw[bname].launch()
    const B = s => `[${bname}] ${s}`
    try {
      // ---------- 1. 上下法：2019年版と同じ回答の並びで照合（記憶範囲の違う3人分） ----------
      for (const cap of [5.5, 7.2, 9.0]) {
        const csvs = {}
        for (const [ver, url] of [['old', OLD], ['new', NEW]]) {
          const ctx = await browser.newContext({ acceptDownloads: true })
          const page = await ctx.newPage(); await page.clock.install()
          await page.goto(url + 'memory_exp_updown.html')
          const dl = page.waitForEvent('download', { timeout: 600000 }); dl.catch(() => { })
          await runTrials(page, cap, 600)
          const d = await dl
          csvs[ver] = { text: fs.readFileSync(await d.path(), 'utf8'), name: d.suggestedFilename() }
          await ctx.close()
        }
        const a = csvs.old.text, b = csvs.new.text
        check(B(`上下法 cap=${cap}：ファイル名`), csvs.old.name === csvs.new.name, `${csvs.old.name} / ${csvs.new.name}`)
        check(B(`上下法 cap=${cap}：見出し行`), a.split(/\r?\n/)[0] === b.split(/\r?\n/)[0])
        check(B(`上下法 cap=${cap}：試行・系列・方向・桁数・正誤`), JSON.stringify(cols(a, [0, 1, 2, 5, 6])) === JSON.stringify(cols(b, [0, 1, 2, 5, 6])),
          `試行数 ${a.trim().split(/\r?\n/).length - 2}`)
        const ma = a.trim().split(/\r?\n/).pop(), mb = b.trim().split(/\r?\n/).pop()
        check(B(`上下法 cap=${cap}：memCap の行`), ma === mb, `${ma} / ${mb}`)
        check(B(`上下法 cap=${cap}：改行と区切り`), (a.match(/\r\n/g) || []).length === (b.match(/\r\n/g) || []).length)
      }

      // ---------- 2. 恒常法：設定・試行数・CSV の書式 ----------
      {
        const ctx = await browser.newContext({ acceptDownloads: true })
        // 実験1の結果を保存した状態を作る（memCap = 7.35）
        const page = await ctx.newPage(); await page.goto(NEW + 'memory_exp_constant.html')
        await page.evaluate(() => localStorage.setItem('enshu-memspan-2026:memcap', '7.35'))
        await page.reload()
        const tryConf = async (mn, mx, rp) => {
          await page.fill('#min', String(mn)); await page.fill('#max', String(mx)); await page.fill('#trialsPerDifficulty', String(rp))
          await page.click('#start'); return (await page.$$eval('#errors li', l => l.map(x => x.textContent)))
        }
        let e = await tryConf(6, 10, 12); check(B('恒常法：誤った最小桁数を止める'), e.length === 1 && e[0].includes('最小'), e.join(' / '))
        e = await tryConf(5, 9, 12); check(B('恒常法：誤った最大桁数を止める'), e.length === 1 && e[0].includes('最大'), e.join(' / '))
        e = await tryConf(5, 10, 10); check(B('恒常法：誤った反復回数を止める'), e.length === 1 && e[0].includes('12'), e.join(' / '))
        await ctx.close()
        // 正しい設定（7.35 → 5〜10桁）で最後まで
        const ctx2 = await browser.newContext({ acceptDownloads: true })
        const p2 = await ctx2.newPage(); await p2.clock.install(); await p2.goto(NEW + 'memory_exp_constant.html')
        await p2.evaluate(() => localStorage.setItem('enshu-memspan-2026:memcap', '7.35')); await p2.reload()
        await p2.fill('#min', '5'); await p2.fill('#max', '10'); await p2.fill('#trialsPerDifficulty', '12'); await p2.click('#start')
        const errs = await p2.$$eval('#errors li', l => l.length); check(B('恒常法：正しい設定（5〜10桁）は通る'), errs === 0)
        await p2.clock.runFor(200)
        const dl = p2.waitForEvent('download', { timeout: 600000 }); dl.catch(() => { })
        const n = await runTrials(p2, 7.5, 100)
        const d = await dl; const csv = fs.readFileSync(await d.path(), 'utf8'); const rows = csv.trim().split(/\r?\n/)
        const cnt = {}; rows.slice(1).forEach(r => { const k = r.split(',')[3]; cnt[k] = (cnt[k] || 0) + 1 })
        check(B('恒常法：72試行で終わり constant.csv を保存'), n === 72 && d.suggestedFilename() === 'constant.csv' && rows.length === 73, `${n}試行, ${d.suggestedFilename()}`)
        check(B('恒常法：各桁12試行'), Object.values(cnt).every(v => v === 12) && Object.keys(cnt).length === 6, JSON.stringify(cnt))
        check(B('恒常法：見出し行が2019年版と同じ'), rows[0] === 'trialNum,progression,response,numberOfDigits,correct')
        await ctx2.close()
        // 実験1の結果がないとき：差が5、反復12だけ確かめる
        const ctx3 = await browser.newContext(); const p3 = await ctx3.newPage(); await p3.goto(NEW + 'memory_exp_constant.html')
        const shown = await p3.isVisible('#nomemcap')
        await p3.fill('#min', '5'); await p3.fill('#max', '11'); await p3.fill('#trialsPerDifficulty', '12'); await p3.click('#start')
        const e3 = await p3.$$eval('#errors li', l => l.map(x => x.textContent))
        check(B('恒常法：実験1の結果がないときは注記を出し、差が5でない設定を止める'), shown && e3.length === 1, e3.join(' / '))
        await ctx3.close()
      }

      // ---------- 3. 全角入力・日本語入力 ----------
      {
        const ctx = await browser.newContext(); const page = await ctx.newPage(); await page.clock.install()
        await page.goto(NEW + 'memory_practice_updown.html')
        const s = await waitDigits(page); await page.clock.runFor(8000)
        const fw = s.replace(/\d/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0))
        await page.fill('#js-input-form', fw)
        const v1 = await page.inputValue('#js-input-form'); const w1 = await page.textContent('#warn')
        check(B('全角の数字は入力欄に残らず、注意が出る'), v1 === '' && w1.includes('半角'), `入力欄="${v1}"`)
        // 変換中の Enter は回答にしない
        await page.fill('#js-input-form', s)
        await page.evaluate(() => {
          const i = document.getElementById('js-input-form')
          i.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }))
          i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, isComposing: true, bubbles: true }))
          i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, bubbles: true }))
          i.dispatchEvent(new CompositionEvent('compositionend', { data: '' }))
        })
        await page.clock.runFor(20)
        const h = await page.textContent('h2')
        check(B('日本語入力の確定の Enter では回答にならない'), /^\d+$/.test(h) || h === '', `h2="${h}"`)
        await page.keyboard.press('Enter'); await page.clock.runFor(20)
        check(B('半角で入力して Enter で回答できる'), (await page.textContent('h2')) === 'correct')
        const fsz = await page.$eval('#stimulus', e => getComputedStyle(e).fontSize)
        check(B('数字列の大きさは48px'), fsz === '48px', fsz)
        await ctx.close()
      }

      // ---------- 4. 途中からの再開・終了後の再表示 ----------
      {
        const ctx = await browser.newContext({ acceptDownloads: true }); const page = await ctx.newPage(); await page.clock.install()
        await page.goto(NEW + 'memory_exp_updown.html')
        await runTrials(page, 7.2, 6)
        const s7 = await waitDigits(page)        // 7試行目の提示中に閉じる（回答していない）
        await page.reload(); await page.clock.runFor(100)
        const panel = await page.isVisible('#resume')
        check(B('再読み込みすると「続きから再開」を出す'), panel && (await page.textContent('#resume')).includes('6試行目まで'))
        await page.click('#resume button.primary'); const s7b = await waitDigits(page)
        check(B('再開すると、同じ桁数で新しい数字列から'), s7b.length === s7.length, `${s7.length}桁 → ${s7b.length}桁`)
        const dl = page.waitForEvent('download', { timeout: 600000 }); dl.catch(() => { })
        // 残りを続ける（最初の6試行と合わせて、通しの回答の並びと同じになるように試行番号を続ける）
        let t = 6
        for (; t < 600; t++) {
          const s = t === 6 ? s7b : await waitDigits(page); if (s === 'end') break
          await page.clock.runFor(8000)
          await page.fill('#js-input-form', decide(t + 1, s.length, 7.2) ? s : wrong(s)); await page.keyboard.press('Enter'); await page.clock.runFor(20)
          if ((await page.textContent('h2')) === 'end') break
          await page.clock.runFor(2980)
        }
        const d = await dl; const csv = fs.readFileSync(await d.path(), 'utf8')
        const nums = csv.trim().split(/\r?\n/).slice(1, -1).map(r => +r.split(',')[0])
        check(B('再開した記録の試行番号が途切れない'), nums.every((v, i) => v === i + 1), `最後の試行 ${nums[nums.length - 1]}`)
        await page.reload(); await page.clock.runFor(100)
        const pre = await page.textContent('#result pre')
        check(B('終了後に開き直しても結果を表示し、やり直さない'), pre === csv && (await page.textContent('h2')) === 'end')
        await ctx.close()
      }
    } catch (e) { check(B('エラー'), false, e.message.split('\n')[0]) }
    await browser.close()
  }
  srv.close()
  let ng = 0
  for (const r of results) { if (!r.ok) ng++; console.log(`${r.ok ? 'OK ' : 'NG '} ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`) }
  console.log(`\n${results.length - ng}/${results.length} OK`)
  process.exit(ng ? 1 : 0)
})()
