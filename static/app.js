// static/app.js

// 現在の問題番号とタイマー用の変数を定義
let currentQuestionIndex = 0;
let timer = 10.00;
let timerInterval;
// 各問題の結果を保存する配列
let results = [];
// スコア（正答数）を初期化
let score = 0;
// 1セグメントあたりの問題数
const segmentSize = 10;  

const currentLevel = typeof level !== 'undefined' ? level : 0;
const currentSegment = typeof segment !== 'undefined' ? segment : 1;

function showResultOverlay(resultType) {
    const overlay = document.createElement('div');
    overlay.classList.add('result-overlay');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    overlay.style.zIndex = '10000';
    overlay.style.cursor = 'pointer';

    const symbol = document.createElement('div');
    symbol.classList.add('symbol');
    symbol.style.fontSize = '200px';
    symbol.style.fontWeight = 'bold';
    symbol.style.textShadow = '3px 3px 6px #000';

    if (resultType === 'correct') {
        symbol.style.color = 'red';
        symbol.textContent = '○';
    } else {
        symbol.style.color = 'blue';
        symbol.textContent = '×';
    }

    overlay.appendChild(symbol);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => {
        overlay.remove();
        nextQuestion();
    });
}

// Fisher-Yatesアルゴリズムで配列をシャッフル
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// カウントダウンタイマーを開始する関数
function startTimer() {
    timer = 10.00; // 初期値 10秒
    document.getElementById('timer').innerText = '残り時間: ' + timer.toFixed(2) + '秒';
    // タイムバーを初期状態にリセット（100%）
    document.getElementById('time-progress').style.width = '100%';
    timerInterval = setInterval(() => {
        timer -= 0.01;
        if (timer <= 0) {
            timer = 0;
            clearInterval(timerInterval);
            document.getElementById('timer').innerText = '残り時間: 0.00秒';
            // タイムバーも0%に更新
            document.getElementById('time-progress').style.width = '0%';
            showResultOverlay('incorrect');
            // 経過時間 = 10.00秒
            results.push({
                question: quizData[currentQuestionIndex].word,
                userAnswer: "",
                correctAnswer: quizData[currentQuestionIndex].correct,
                time: "10.00"
            });   
        } else {
            document.getElementById('timer').innerText = '残り時間: ' + timer.toFixed(2) + '秒';
            // 残り時間に応じてバーの幅を更新（最大10秒→100%）
            let progressPercent = (timer / 10.00) * 100;
            document.getElementById('time-progress').style.width = progressPercent + '%';
        }
    }, 10); // 10msごとに更新
}

// タイマーを停止する関数
function stopTimer() {
    clearInterval(timerInterval);
}

// 現在の問題を表示する関数
function displayQuestion() {
    startTimer();
    let questionData = quizData[currentQuestionIndex];
    
    // 問題文（英単語）を表示
    document.getElementById('quiz-question').innerText = questionData.word;
    
    // 正解とダミー選択肢を1つの配列にまとめ、ランダムにシャッフル
    let options = [questionData.correct, ...questionData.dummy];
    options = shuffle(options);
    
    // 選択肢を表示する領域をクリア
    let optionsContainer = document.getElementById('options');
    optionsContainer.innerHTML = "";
    
    // 各選択肢のボタンを生成
    options.forEach(option => {
        let btn = document.createElement('button');
        btn.className = 'btn btn-primary option-btn m-2';
        btn.innerText = option;
        btn.onclick = () => checkAnswer(option);
        optionsContainer.appendChild(btn);
    });
}

// ユーザーの解答をチェックする関数
function checkAnswer(selectedAnswer) {
    stopTimer();
    let currentQuestion = quizData[currentQuestionIndex];
    // 経過時間 = 初期時間 10.00秒 から残り時間を引く
    let elapsedTime = 10.00 - timer;
    
    let isCorrect = (selectedAnswer === currentQuestion.correct);
    if (isCorrect) {
        score++;
        showResultOverlay('correct');
    } else {
        showResultOverlay('incorrect');
    }    
    
    results.push({
        question: currentQuestion.word,
        userAnswer: selectedAnswer,
        correctAnswer: currentQuestion.correct,
        // 経過時間として記録（小数点以下2桁）
        time: elapsedTime.toFixed(2)
    });
    
    console.log("経過時間: " + elapsedTime.toFixed(2) + "秒");
}



// 次の問題に進む関数
function nextQuestion() {
    currentQuestionIndex++;
    if (!isShuffled) {
        // セグメントモードの場合（10問ごとに結果画面を表示）
        if ((currentQuestionIndex % segmentSize === 0) || (currentQuestionIndex >= quizData.length)) {
            let segmentTotalTime = results.reduce((sum, item) => sum + parseFloat(item.time), 0);
            sendResults(score, results.length, segmentTotalTime);
            
            // クイズ画面を非表示にして、結果画面を表示
            document.getElementById('quiz-container').style.display = 'none';
            document.getElementById('timer').style.display = 'none';
            displayResults();
        } else {
            displayQuestion();
        }
    } else {
        // シャッフルモードの場合：全50問が解き終わるまで結果画面は表示しない
        if (currentQuestionIndex >= quizData.length) {
            let totalTime = results.reduce((sum, item) => sum + parseFloat(item.time), 0);
            sendResults(score, results.length, totalTime);
            document.getElementById('quiz-container').style.display = 'none';
            document.getElementById('timer').style.display = 'none';
            displayResults();
        } else {
            displayQuestion();
        }
    }
}


function displayResults() {
    // 結果概要（スコア）を表示
    const summary = document.getElementById('result-summary');
    summary.innerText = "あなたのスコア: " + score + " / " + results.length;

    // 結果詳細テーブルのtbodyを初期化
    const resultDetails = document.getElementById('result-details');
    resultDetails.innerHTML = "";

    // 結果配列 results をループして、各問題の結果をテーブル行として追加
    results.forEach((result, index) => {
        const row = document.createElement('tr');

        const cellNum = document.createElement('td');
        cellNum.innerText = index + 1;
        row.appendChild(cellNum);

        const cellQuestion = document.createElement('td');
        cellQuestion.innerText = result.question;
        row.appendChild(cellQuestion);

        const cellUserAnswer = document.createElement('td');
        cellUserAnswer.innerText = result.userAnswer;
        if (result.userAnswer === result.correctAnswer) {
            cellUserAnswer.classList.add('answer-correct');
        } else {
            cellUserAnswer.classList.add('answer-incorrect');
        }
        row.appendChild(cellUserAnswer);

        const cellCorrect = document.createElement('td');
        cellCorrect.innerText = result.correctAnswer;
        row.appendChild(cellCorrect);

        const cellTime = document.createElement('td');
        cellTime.innerText = result.time;
        row.appendChild(cellTime);

        resultDetails.appendChild(row);
    });

    // ボタン用のコンテナを作成（左右に配置）
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.width = '100%';

    // 左側：セグメント選択に戻るボタン
    if (!document.getElementById('back-to-segments')) {
        let backBtn = document.createElement('button');
        backBtn.id = 'back-to-segments';
        backBtn.className = 'btn btn-secondary';
        backBtn.innerText = '戻る';
        backBtn.onclick = function() {
            window.location.href = '/segments/' + currentLevel;
        };
        buttonContainer.appendChild(backBtn);
    }

    // 右側：次の10問で進むボタン（セグメントモードの場合のみ、かつ最後のセグメントでないとき）
    if (!isShuffled && currentSegment < 5) {
        if (!document.getElementById('continue-btn')) {
            let continueBtn = document.createElement('button');
            continueBtn.id = 'continue-btn';
            continueBtn.className = 'btn btn-primary';
            continueBtn.innerText = '次へ進む';
            continueBtn.onclick = continueQuiz;
            buttonContainer.appendChild(continueBtn);
        }
    }
    // セグメントモードかつ最後のセグメントの場合、次のボタンは表示しない

    // 結果画面の下部にボタンコンテナを追加
    document.getElementById('result-container').appendChild(buttonContainer);
    document.getElementById('result-container').style.display = 'block';
}



function continueQuiz() {
    // セグメント結果のリセット
    results = [];
    score = 0;
    currentQuestionIndex = 0; // 新しいセグメント開始時にインデックスをリセット

    // 結果表示領域の動的部分（結果概要とテーブルの中身）をクリアする
    document.getElementById('result-summary').innerText = "";
    document.getElementById('result-details').innerHTML = "";

    // 既存の「次の10問で進む」ボタンがあれば削除する
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) continueBtn.remove();

    // 結果表示領域を非表示にする（静的なHTMLはそのまま）
    document.getElementById('result-container').style.display = 'none';

    // クイズ画面とタイマーを再表示する
    document.getElementById('quiz-container').style.display = 'block';
    document.getElementById('timer').style.display = 'block';

    if (!isShuffled) {
        // セグメントモードの場合
        // 最後のセグメント（例：セグメント5）の場合は「次の10問で進む」ボタンを表示しない
        if (currentSegment < 5) {
            // 次のセグメントページへリダイレクト
            window.location.href = '/quiz/' + currentLevel + '/' + (currentSegment + 1);
        } else {
            // 最後のセグメントの場合は結果画面へ遷移（または終了処理）
            alert("すべての問題が終了しました！");
            // ここで必要に応じて結果画面やセグメント選択画面への遷移処理を追加
            // 例: window.location.href = '/results';
        }
    } else {
        // シャッフルモードの場合は、全50問が解き終わるまで結果画面を表示しない
        if (currentQuestionIndex < quizData.length) {
            displayQuestion();
        } else {
            alert("すべての問題が終了しました！");
            // 全問終了後は結果画面へ進む
            document.getElementById('quiz-container').style.display = 'none';
            document.getElementById('timer').style.display = 'none';
            displayResults();
        }
    }
}



// DOMがロードされたら最初の問題を表示
document.addEventListener('DOMContentLoaded', () => {
    displayQuestion();
});


// 成績データを送信する関数
function sendResults(score, total, totalTime) {
    const resultData = {
        score: score,
        total: total,
        time: totalTime,
        user: window.userEmail || "anonymous"  
    };

    fetch('/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',  // ← これを追加
        body: JSON.stringify(resultData)
    })
    .then(response => response.json())
    .then(data => {
        console.log("Results submitted:", data);
    })
    .catch(error => {
        console.error("Error submitting results:", error);
    });
}