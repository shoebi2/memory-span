const { h, app } = hyperapp

// 実験のパラメータを决める
const settings = {
  initialDifficulty: 4,
  trials: 10,
}

const state = {
  presentation: "",
  visibility: "visible",
  inputBox: "",
  result: "",
  readonly: "readonly",
  trialNum: 1,
  seriesType: 1, // 上昇系列:1, 下降系列:-1
  seriesNum: 1,
  numberOfDigits: settings.initialDifficulty,
  log: [{
    trialNum: "trialNum",
    seriesNum: "series",
    seriesType: "seriesType",
    progression: "progression",
    response: "response",
    numberOfDigits: "numberOfDigits",
    correct: "correct"
  }],
}

// 画面遷移を担当する関数群
const actions = {
  startMemorize: () => (state, actions) => {
    setTimeout(actions.endMemorize, 3000)
    return { ...state, presentation: helpers.createProgression(state.numberOfDigits), inputBox: "" }
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
    const latestTrialLog = {
      trialNum: state.trialNum,
      seriesNum: state.seriesNum,
      seriesType: state.seriesType,
      progression: state.presentation,
      response: state.inputBox,
      numberOfDigits: state.numberOfDigits,
      correct: correct ? 1 : 0,
    }
    const nextSeriesType = helpers.switchSeriesType(state.log[state.log.length - 1], latestTrialLog)
    state = {
      ...state,
      trialNum: state.trialNum + 1,
      log: state.log.concat([latestTrialLog]),
      presentation: correct ? "correct" : "incorrect",
      visibility: "visible",
      numberOfDigits: state.numberOfDigits + nextSeriesType,
      seriesType: nextSeriesType,
      readonly: "readonly",
      seriesNum: state.seriesNum + (nextSeriesType != state.seriesType ? 1 : 0),
    }
    if (state.trialNum > settings.trials) {
      return { ...state, presentation: "end", result: "練習終わり"}
    }
    setTimeout(actions.startMemorize, 3000)
    return state
  },
  updateInput: e => state => {
    return { ...state, inputBox: e.target.value }
  },
}

// データ処理を担当する関数群
const helpers = {
  createProgression: length => {
    const max = 10 ** length
    const min = 10 ** (length - 1)
    return String(Math.floor(Math.random() * (max - min) + min))
  },
  switchSeriesType: (latestSecondTrialLog, latestTrialLog) => {
    if (latestTrialLog.trialNum == 1) {
      return 1
    }
    // 文字数が0にならないようにする
    if (latestTrialLog.numberOfDigits == 1) {
      return 1
    }
    if (latestTrialLog.seriesType == 1 && latestSecondTrialLog.correct == 0 && latestTrialLog.correct == 0) {
      return -1
    } else if (latestTrialLog.seriesType == -1 && latestSecondTrialLog.correct == 1 && latestTrialLog.correct == 1) {
      return 1
    } else {
      return latestTrialLog.seriesType
    }
  },
}

const view = (state, actions) => (
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
        [state.readonly]: "readonly"
      })
    ]),
    h("br"),
    h("pre", {}, state.result)
  ])
)

// 開発者向け
//const updown_helpers = helpers
//module.exports = updown_helpers

const main = app(state, actions, view, document.body)
main.startMemorize()