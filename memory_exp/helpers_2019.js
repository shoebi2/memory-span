// 2019年版（心理学研究室サーバー enshu2019/memory_exp）の計算部分をそのまま写したもの。
// 記憶範囲（memCap）の計算・系列の反転・刺激の作り方・CSV の書式は、この関数だけで決まる。
// ここを変えると昨年度までとデータの意味が変わるので、変えないこと（変えた場合は tests/compare_with_2019.js で照合する）。

// ---- exp_updown.js の helpers（2019年版から変更なし） ----
const updownHelpers = {
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
    const successiveCorrectIndexes = updownHelpers.IndexesOf(successiveCorrectArray, 2)
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

// ---- exp_constant.js の helpers と試行順のシャッフル（2019年版から変更なし） ----
const constantHelpers = {
  createProgression: updownHelpers.createProgression,
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
  makeDifficultyList: conf => {
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
    return difficultyList
  },
}
