const { h, app } = hyperapp

const state = {
  setDifficultyPhase: true,
  presentation: "",
  visibility: "visible",
  inputBox: "",
  result: "",
  readonly: "readonly",
  trialNum: 1,
  difficultyList: [],
  log: [{
    trialNum: "trialNum",
    progression: "progression",
    response: "response",
    numberOfDigits: "numberOfDigits",
    correct: "correct",
  }]
}

const actions = {
  startMemorize: () => (state, actions) => {
    setTimeout(actions.endMemorize, 3000)
    return { ...state, presentation: helpers.createProgression(state.difficultyList[state.trialNum - 1]), inputBox: "" }
  },
  endMemorize: () => (state, actions) => {
    setTimeout(actions.startAnswer, 5000)
    return { ...state, visibility: "hidden" }
  },
  startAnswer: () => state => {
    document.getElementById("js-input-form").focus()
    return { ...state, readonly: "writable" }
  },
  submit: e => (state, actions) => {
    // エンターキー以外は無視
    if (e.keyCode !== 13) {
      return state
    }
    // 保持時間中の入力は受け付けない
    if (state.readonly == "readonly") {
      return state
    }
    // 正解判定
    const correct = state.presentation == state.inputBox
    latestTrialLog = {
      trialNum: state.trialNum,
      progression: state.presentation,
      response: state.inputBox,
      numberOfDigits: state.difficultyList[state.trialNum - 1],
      correct: correct ? 1 : 0,
    }
    state = {
      ...state,
      trialNum: state.trialNum + 1,
      log: state.log.concat([latestTrialLog]),
      presentation: correct ? "correct" : "incorrect",
      visibility: "visible",
      readonly: "readonly"
    }
    if (state.trialNum > state.difficultyList.length) {
      const resultCSV = helpers.createCSV(state.log)
      const resultBlob = new Blob([resultCSV])
      const virtualAnchor = document.createElement("a")
      virtualAnchor.setAttribute("download", "constant.csv")
      virtualAnchor.href = URL.createObjectURL(resultBlob)
      virtualAnchor.click()
      return { ...state, presentation: "end", result: resultCSV }
    }
    setTimeout(actions.startMemorize, 3000)
    return state
  },
  updateInput: e => state => {
    return { ...state, inputBox: e.target.value }
  },
  submitConfiguration: () => (state, actions) => {
    const conf = {
      min: parseInt(document.getElementById("min").value),
      max: parseInt(document.getElementById("max").value),
      trialsPerDifficulty: parseInt(document.getElementById("trialsPerDifficulty").value)
    }
    let difficultyList = []
    for (let i = conf.min; i <= conf.max; i++) {
      difficultyList.push(...new Array(conf.trialsPerDifficulty).fill(i))
    }
    // シャッフル https://qiita.com/artistan/items/9eb9a0fb14f4ec3a8764
    for (var i = difficultyList.length - 1; i >= 0; i--) {
      // 0~iのランダムな数値を取得
      var rand = Math.floor(Math.random() * (i + 1));
      // 配列の数値を入れ替える
      [difficultyList[i], difficultyList[rand]] = [difficultyList[rand], difficultyList[i]]
    }
    setTimeout(actions.startMemorize, 100)
    return { ...state, setDifficultyPhase: false, configuration: conf, difficultyList: difficultyList }
  }
}

// データ処理を担当する関数群
const helpers = {
  createProgression: length => {
    const max = 10 ** length
    const min = 10 ** (length - 1)
    return String(Math.floor(Math.random() * (max - min) + min))
  },
  createCSV: arrayOfLogs => {
    return arrayOfLogs.map(log => {
      return [
        log.trialNum,
        log.progression,
        log.response,
        log.numberOfDigits,
        log.correct
      ]
    }).map(row => row.join(",")).join("\r\n")
  },
}

const view = (state, actions) => (
  state.setDifficultyPhase ?
    h("div", {}, [
      h("main", { class: "center" }, [
        h("h1", {}, "input range"),
        h("p", {}, [
          h("input", { id: "min", type: "number" }),
          "~",
          h("input", { id: "max", type: "number", min: "0" }),
          "桁"
        ]),
        h("p", {}, ["各桁ごとに", h("input", { id: "trialsPerDifficulty", type: "number" }), "試行ずつ"]),
        h("p", {}, [
          h("button", { onclick: actions.submitConfiguration }, "実験開始")
        ])
      ])
    ]) :
    h("div", {}, [
      h("main", { class: "center" }, [
        h("h1", {}, "memory experiment"),
        h("h2", {
          class: "disable-copy",
          style: { visibility: state.visibility }
        }, state.presentation),
        h("input", {
          id: "js-input-form",
          value: state.inputBox,
          oninput: actions.updateInput,
          onkeydown: actions.submit,
          [state.readonly]: ""
        })
      ]),
      h("br"),
      h("p", {}, state.result ? "実験が終わりました。以下の結果と同じものが自動でダウンロードされたので確認してください。" : ""),
      h("pre", {}, state.result)
    ])
)

// 開発者向け
//constant_helpers = helpers
//module.exports = constant_helpers

const main = app(state, actions, view, document.body)
