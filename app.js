let allSets = [];
let currentSetIndex = 0;
let currentArticleIndex = 0;
let currentQuestionIndex = 0;
const userAnswers = {};
let secondsPassed = 0;
let timerInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("upload-date").valueAsDate = new Date();
  initData();
  startTimer();
});

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  if (screenId === 'quiz-screen') {
    populateDropdown();
    if (allSets.length > 0) loadState();
  }
}

function initData() {
  const localData = localStorage.getItem("yds_question_sets");
  if (localData) {
    allSets = JSON.parse(localData);
  } else if (window.ydsFransizcaDeneme) {
    allSets = [{
      id: "set_default",
      date: new Date().toISOString().split('T')[0],
      topic: "Genel Fransızca",
      articles: window.ydsFransizcaDeneme
    }];
    localStorage.setItem("yds_question_sets", JSON.stringify(allSets));
  }
}

function populateDropdown() {
  const dropdown = document.getElementById("set-select");
  dropdown.innerHTML = "";
  if (allSets.length === 0) {
    dropdown.innerHTML = `<option>Henüz yüklenmiş veri yok</option>`;
    return;
  }
  allSets.forEach((set, index) => {
    const opt = document.createElement("option");
    opt.value = index;
    opt.innerText = `[${set.date}] - ${set.topic}`;
    if (index === currentSetIndex) opt.selected = true;
    dropdown.appendChild(opt);
  });
}

function handleSaveSet() {
  const topic = document.getElementById("upload-topic").value.trim();
  const date = document.getElementById("upload-date").value;
  const jsonText = document.getElementById("upload-json").value.trim();

  if (!topic || !jsonText) {
    alert("Lütfen Konu Başlığı ve Soru Verisini doldurun!");
    return;
  }

  try {
    const parsedArticles = JSON.parse(jsonText);
    const newSet = {
      id: "set_" + Date.now(),
      date: date || new Date().toISOString().split('T')[0],
      topic: topic,
      articles: Array.isArray(parsedArticles) ? parsedArticles : [parsedArticles]
    };

    allSets.unshift(newSet);
    localStorage.setItem("yds_question_sets", JSON.stringify(allSets));
    alert("✅ Soru seti tarihe ve konuya göre başarıyla entegre edildi!");

    document.getElementById("upload-topic").value = "";
    document.getElementById("upload-json").value = "";

    currentSetIndex = 0;
    currentArticleIndex = 0;
    currentQuestionIndex = 0;
    showScreen('quiz-screen');
  } catch (err) {
    alert("❌ HATA: Yapıştırdığınız veri geçerli bir JSON formatı değil.");
  }
}

function changeSet(index) {
  currentSetIndex = parseInt(index);
  currentArticleIndex = 0;
  currentQuestionIndex = 0;
  loadState();
}

function renderNavGrid(questions) {
  const grid = document.getElementById("question-nav-grid");
  grid.innerHTML = "";

  questions.forEach((q, idx) => {
    const btn = document.createElement("button");
    btn.className = "q-nav-btn";
    btn.innerText = idx + 1;

    if (userAnswers[q.id]) {
      btn.classList.add("answered");
    }
    if (idx === currentQuestionIndex) {
      btn.classList.add("active");
    }

    btn.onclick = () => {
      currentQuestionIndex = idx;
      loadState();
    };

    grid.appendChild(btn);
  });
}

function loadState() {
  const activeSet = allSets[currentSetIndex];
  if (!activeSet || !activeSet.articles || activeSet.articles.length === 0) return;

  const currentArticle = activeSet.articles[currentArticleIndex];
  const currentQuestion = currentArticle.questions[currentQuestionIndex];

  // Başlıklar
  document.getElementById("article-number").innerText = `Metin ${currentArticleIndex + 1} / ${activeSet.articles.length}`;
  document.getElementById("article-title").innerText = currentArticle.title;
  document.getElementById("article-text").innerText = currentArticle.text;

  document.getElementById("question-number").innerText = `Soru ${currentQuestionIndex + 1} / ${currentArticle.questions.length}`;

  // Navigasyon Izgarasını Yenile
  renderNavGrid(currentArticle.questions);

  // Öncül (Roma Rakamı vs.) Ve Soru Kökü Ayrıştırması
  const prefaceBox = document.getElementById("question-preface");
  if (currentQuestion.preface) {
    prefaceBox.innerText = currentQuestion.preface;
    prefaceBox.style.display = "block";
  } else {
    prefaceBox.style.display = "none";
  }

  document.getElementById("question-title").innerText = `Soru ${currentQuestionIndex + 1}: ${currentQuestion.question}`;

  calculateScore();

  // Şıklar
  const optionsGroup = document.getElementById("options-group");
  optionsGroup.innerHTML = "";

  const savedAnswer = userAnswers[currentQuestion.id];

  currentQuestion.options.forEach((opt) => {
    const letter = opt.charAt(0);
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerText = opt;

    if (savedAnswer) {
      btn.disabled = true;
      if (letter === currentQuestion.answer) btn.classList.add("correct");
      if (letter === savedAnswer && savedAnswer !== currentQuestion.answer) btn.classList.add("wrong");
    } else {
      btn.onclick = () => checkAnswer(letter, currentQuestion);
    }
    optionsGroup.appendChild(btn);
  });

  // Çözüm Analizi
  const expBox = document.getElementById("explanation-box");
  if (savedAnswer) {
    expBox.innerHTML = `💡 <strong>Çözüm Analizi:</strong> ${currentQuestion.explanation}`;
    expBox.style.display = "block";
  } else {
    expBox.style.display = "none";
  }

  updateNavButtons();
}

function checkAnswer(selectedLetter, question) {
  userAnswers[question.id] = selectedLetter;
  loadState();
}

function calculateScore() {
  let correct = 0, wrong = 0;
  const activeSet = allSets[currentSetIndex];
  if (!activeSet) return;

  activeSet.articles.forEach(article => {
    article.questions.forEach(q => {
      const ans = userAnswers[q.id];
      if (ans) {
        if (ans === q.answer) correct++;
        else wrong++;
      }
    });
  });

  document.getElementById("score-tracker").innerText = `Doğru: ${correct} | Yanlış: ${wrong}`;
}

function updateNavButtons() {
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const activeSet = allSets[currentSetIndex];

  prevBtn.disabled = (currentArticleIndex === 0 && currentQuestionIndex === 0);

  const currentArticle = activeSet.articles[currentArticleIndex];

  if (currentQuestionIndex === currentArticle.questions.length - 1) {
    if (currentArticleIndex === activeSet.articles.length - 1) {
      nextBtn.innerText = "Seti Tamamla 🏁";
    } else {
      nextBtn.innerText = "Sonraki Makaleye Geç ➔";
    }
  } else {
    nextBtn.innerText = "Sonraki Soru ➔";
  }
}

function nextQuestion() {
  const activeSet = allSets[currentSetIndex];
  const currentArticle = activeSet.articles[currentArticleIndex];

  if (currentQuestionIndex < currentArticle.questions.length - 1) {
    currentQuestionIndex++;
  } else if (currentArticleIndex < activeSet.articles.length - 1) {
    currentArticleIndex++;
    currentQuestionIndex = 0;
  } else {
    alert("Bu setteki tüm soruları tamamladınız!");
    return;
  }
  loadState();
}

function prevQuestion() {
  const activeSet = allSets[currentSetIndex];

  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
  } else if (currentArticleIndex > 0) {
    currentArticleIndex--;
    const prevArticle = activeSet.articles[currentArticleIndex];
    currentQuestionIndex = prevArticle.questions.length - 1;
  }
  loadState();
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    secondsPassed++;
    const m = Math.floor(secondsPassed / 60);
    const s = secondsPassed % 60;
    document.getElementById("timer").innerText = `⏱️ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, 1000);
}
