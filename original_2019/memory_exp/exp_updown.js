const { h, app } = hyperapp

// 実験のパラメータを决める
const settings = {
  initialDifficulty: 4,
  series: 20,
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
    if (state.seriesNum > settings.series) {
      const memCap = helpers.separateIntoSeries(state.log).map(helpers.calcReprOfSeries).reduce((a, c) => a + c, 0) / settings.series
      const resultCSV = helpers.createCSV(state.log.concat([{trialNum: "memCap", seriesNum: memCap}]))
      const resultBlob = new Blob([resultCSV])
      const virtualAnchor = document.createElement("a")
      virtualAnchor.setAttribute("download", "updown.csv")
      virtualAnchor.href = URL.createObjectURL(resultBlob)
      virtualAnchor.click()
      return { ...state, presentation: "end", result: resultCSV}
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
  createCSV: arrayOfLogs => {
    return arrayOfLogs.map(log => {
      return [
        log.trialNum,
        log.seriesNum,
        log.seriesType,
        log.progression,
        log.response,
        log.numberOfDigits,
        log.correct
      ]
    }).map(row => row.join(",")).join("\r\n")
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
  separateIntoSeries: logs => {
    const separatedLogs = []
    for (let i = 1; i <= logs[logs.length - 1].seriesNum; i++) {
      separatedLogs.push(logs.filter(log => log.seriesNum == i))
    }
    return separatedLogs
  },
  // その系列の代表値を計算する
  calcReprOfSeries: thisSeries => {
    const seriesType = thisSeries[0].seriesType
    const correctTrials = thisSeries.filter(trial => trial.correct == 1)
    // 系列内に正解が1つもない場合
    if (correctTrials.length == 0) {
      // 2連続不正解の上昇系列では系列内第1試行より1つ少ない桁数を返すこととする
      if (seriesType == 1) {
        return thisSeries[0].numberOfDigits - 1
      } else { // 桁数が1になるまで不正解を続けた下降系列は0を返すこととする
        return 0
      }
    }
    const correctArray = thisSeries.map(trial => trial.correct)
    const successiveCorrectArray = []
    for (let i = 1; i < correctArray.length; i++) {
      successiveCorrectArray.push(correctArray[i - 1] + correctArray[i])
    }
    const successiveCorrectIndexes = helpers.IndexesOf(successiveCorrectArray, 2)
    // 2連続正答がない（上昇系列で起こりうる）ときは系列内第1試行より1つ少ない桁数を返すこととする
    if (successiveCorrectIndexes.length == 0) {
      if (seriesType == 1) {
        return thisSeries[0].numberOfDigits - 1
      } else {
        return 0
      }
    }
    if (seriesType == 1) {
      return thisSeries[Math.max(...successiveCorrectIndexes) + 1].numberOfDigits
    }
    return thisSeries[successiveCorrectIndexes[0]].numberOfDigits
  },
  IndexesOf: (array, value) => {
    const indexes = []
    let idx = array.indexOf(value)
    while (idx != -1) {
      indexes.push(idx)
      idx = array.indexOf(value, idx + 1)
    }
    return indexes
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
    h("p", {}, state.result ? "実験が終わりました。以下の結果と同じものが自動でダウンロードされたので確認してください。" : ""),
    h("pre", {}, state.result)
  ])
)

// 開発者向け
//const updown_helpers = helpers
//module.exports = updown_helpers

const main = app(state, actions, view, document.body)
main.startMemorize()
