pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let selectedFile = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let timeSpentPerQuestion = {};
let questionStartTime = 0;
let timerInterval = null;
let secondsPassed = 0;

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file && file.type === "application/pdf") {
    selectedFile = file;
    document.getElementById("fileNameDisplay").textContent = file.name;
    document.getElementById("startParseBtn").classList.remove("hidden");
  } else {
    alert("Lütfen geçerli bir PDF dosyası seçin.");
  }
}

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

async function startAnalysis() {
  if (!selectedFile) return;

  document.getElementById("uploadScreen").classList.add("hidden");
  document.getElementById("loadingScreen").classList.remove("hidden");

  try {
    const pdfText = await extractTextFromPDF(selectedFile);
    
    const response = await fetch("/api/parse-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfText })
    });

    const data = await response.json();

    if (!response.ok || !data.questions || data.questions.length === 0) {
      throw new Error(data.error || "Sorular ayrıştırılamadı.");
    }

    currentQuestions = data.questions;
    document.getElementById("loadingScreen").classList.add("hidden");
    startQuiz();

  } catch (error) {
    alert("Hata: " + error.message);
    document.getElementById("loadingScreen").classList.add("hidden");
    document.getElementById("uploadScreen").classList.remove("hidden");
  }
}

function startQuiz() {
  document.getElementById("quizScreen").classList.remove("hidden");
  currentQuestionIndex = 0;
  userAnswers = {};
  timeSpentPerQuestion = {};
  secondsPassed = 0;

  timerInterval = setInterval(() => {
    secondsPassed++;
    const mins = String(Math.floor(secondsPassed / 60)).padStart(2, '0');
    const secs = String(secondsPassed % 60).padStart(2, '0');
    document.getElementById("timerBadge").textContent = `⏱️ ${mins}:${secs}`;
  }, 1000);

  renderQuestion();
}

function trackTimeForCurrentQuestion() {
  if (questionStartTime > 0) {
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
    timeSpentPerQuestion[currentQuestionIndex] = (timeSpentPerQuestion[currentQuestionIndex] || 0) + timeSpent;
  }
}

function renderQuestion() {
  trackTimeForCurrentQuestion();
  questionStartTime = Date.now();

  const q = currentQuestions[currentQuestionIndex];
  document.getElementById("questionCounter").textContent = `Soru ${currentQuestionIndex + 1} / ${currentQuestions.length}`;
  
  // Multiple Choice kaçağını engelleme kontrolü
  let typeDisplay = q.type || "Gramer / Dilbilgisi";
  if (typeDisplay.toLowerCase().includes("multiple") || typeDisplay.toLowerCase().includes("choice")) {
    typeDisplay = "Gramer / Dilbilgisi";
  }
  document.getElementById("questionTypeTag").textContent = typeDisplay;

  if (q.passage) {
    document.getElementById("passageContainer").classList.remove("hidden");
    document.getElementById("passageText").textContent = q.passage;
  } else {
    document.getElementById("passageContainer").classList.add("hidden");
  }

  document.getElementById("questionText").textContent = q.question;

  const optionsContainer = document.getElementById("optionsContainer");
  optionsContainer.innerHTML = "";

  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    if (userAnswers[currentQuestionIndex] === opt) {
      btn.classList.add("selected");
    }
    btn.textContent = opt;
    btn.onclick = () => selectOption(opt);
    optionsContainer.appendChild(btn);
  });

  document.getElementById("prevBtn").disabled = currentQuestionIndex === 0;
  document.getElementById("nextBtn").classList.toggle("hidden", currentQuestionIndex === currentQuestions.length - 1);
  document.getElementById("finishBtn").classList.toggle("hidden", currentQuestionIndex !== currentQuestions.length - 1);
}

function selectOption(optionStr) {
  userAnswers[currentQuestionIndex] = optionStr;
  renderQuestion();
}

function navigateQuestion(step) {
  currentQuestionIndex += step;
  renderQuestion();
}

function finishQuiz() {
  trackTimeForCurrentQuestion();
  clearInterval(timerInterval);

  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.remove("hidden");

  let correctCount = 0;
  let emptyCount = 0;
  const typeStats = {};

  currentQuestions.forEach((q, idx) => {
    let type = q.type || "Gramer / Dilbilgisi";
    if (type.toLowerCase().includes("multiple") || type.toLowerCase().includes("choice")) {
      type = "Gramer / Dilbilgisi";
    }

    const timeSpent = timeSpentPerQuestion[idx] || 0;
    const userAnswer = userAnswers[idx];

    if (!typeStats[type]) {
      typeStats[type] = { total: 0, correct: 0, wrong: 0, empty: 0, totalTime: 0 };
    }

    typeStats[type].total++;
    typeStats[type].totalTime += timeSpent;

    if (!userAnswer) {
      emptyCount++;
      typeStats[type].empty++;
    } else if (userAnswer === q.correct) {
      correctCount++;
      typeStats[type].correct++;
    } else {
      typeStats[type].wrong++;
    }
  });

  const totalCount = currentQuestions.length;
  const ydsScore = (correctCount * (100 / totalCount)).toFixed(1);
  
  document.getElementById("ydsScoreText").textContent = ydsScore;
  document.getElementById("scoreText").textContent = `${correctCount} / ${totalCount}`;
  document.getElementById("emptyText").textContent = emptyCount;
  
  const mins = String(Math.floor(secondsPassed / 60)).padStart(2, '0');
  const secs = String(secondsPassed % 60).padStart(2, '0');
  document.getElementById("totalTimeText").textContent = `${mins}:${secs}`;

  let level = "E / Baraj Altı";
  if (ydsScore >= 90) level = "A (90-100)";
  else if (ydsScore >= 80) level = "B (80-89)";
  else if (ydsScore >= 70) level = "C (70-79)";
  else if (ydsScore >= 60) level = "D (60-69)";
  else if (ydsScore >= 50) level = "E (50-59)";
  document.getElementById("ydsLevelTag").textContent = `YDS Seviyeniz: ${level}`;

  const chartContainer = document.getElementById("typeAnalysisChart");
  chartContainer.innerHTML = "";

  let slowestType = "";
  let maxAvgTime = 0;

  for (const [type, stat] of Object.entries(typeStats)) {
    const avgSec = Math.round(stat.totalTime / stat.total);
    const successRate = Math.round((stat.correct / stat.total) * 100);

    if (avgSec > maxAvgTime) {
      maxAvgTime = avgSec;
      slowestType = type;
    }

    const card = document.createElement("div");
    card.className = "chart-card";
    card.innerHTML = `
      <div class="chart-header">
        <span class="chart-type-title">${type}</span>
        <span class="chart-badge ${successRate >= 70 ? 'good' : successRate >= 40 ? 'medium' : 'bad'}">%${successRate} Başarı</span>
      </div>
      <div class="chart-bar-bg">
        <div class="chart-bar-fill ${successRate >= 70 ? 'bg-good' : successRate >= 40 ? 'bg-medium' : 'bg-bad'}" style="width: ${successRate}%;"></div>
      </div>
      <div class="chart-details">
        <span><b>${stat.correct}</b> Doğru / <b>${stat.wrong}</b> Yanlış / <b>${stat.empty}</b> Boş</span>
        <span>⏱️ Ort. <b>${avgSec} sn</b> / soru</span>
      </div>
    `;
    chartContainer.appendChild(card);
  }

  document.getElementById("analysisAdviceText").innerHTML = `
    En çok zaman harcadığınız soru tipi: <strong>${slowestType || 'Soru Tipi'}</strong> (Soru başına ort. ${maxAvgTime} saniye). <br><br>
    YDS'de zaman yönetimi kritik önem taşır. Soru başına ortalama 1.5 - 2 dakikayı aşmamaya özen göstermelisiniz. ${ydsScore < 70 ? 'Özellikle düşük başarı oranına sahip olduğunuz soru gruplarının çözüm taktiklerini tekrar incelemeniz önerilir.' : 'Tebrikler! Yüksek başarı oranına sahipsiniz, hızınızı ve soru taktiklerinizi koruyun.'}
  `;
}

function resetApp() {
  selectedFile = null;
  currentQuestions = [];
  userAnswers = {};
  timeSpentPerQuestion = {};
  document.getElementById("fileNameDisplay").textContent = "Henüz dosya seçilmedi";
  document.getElementById("startParseBtn").classList.add("hidden");
  document.getElementById("resultScreen").classList.add("hidden");
  document.getElementById("uploadScreen").classList.remove("hidden");
}
