pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentQuestions = [];
let currentIndex = 0;
let userAnswers = {}; 
let timeSpentPerQuestion = {}; 
let questionStartTime = 0;

let timerInterval = null;
let secondsPassed = 0;
let progressInterval = null;

const funnyQuotes = [
  "Çöp adam YDS paragraflarını taşıyor... 📦",
  "Cloze test şıkları hizalanıyor... 🔍",
  "Grammar kuralları gözden geçiriliyor... 📚",
  "Gemini yapay zekası paragrafları inceliyor... 🤖",
  "Son rötuşlar yapılıyor, az kaldı... 🚀"
];

function startProgressAnimation() {
  let percent = 0;
  const progressBar = document.getElementById("progressBar");
  const runner = document.getElementById("runner");
  const percentText = document.getElementById("progressPercent");
  const quoteText = document.getElementById("funnyQuote");

  progressBar.style.width = "0%";
  runner.style.left = "0%";
  percentText.textContent = "%0";

  clearInterval(progressInterval);
  
  progressInterval = setInterval(() => {
    if (percent < 92) {
      percent += Math.floor(Math.random() * 4) + 1;
      if (percent > 92) percent = 92;

      progressBar.style.width = percent + "%";
      runner.style.left = percent + "%";
      percentText.textContent = `%${percent}`;

      const quoteIndex = Math.floor((percent / 100) * funnyQuotes.length);
      if (funnyQuotes[quoteIndex]) {
        quoteText.textContent = funnyQuotes[quoteIndex];
      }
    }
  }, 400);
}

function completeProgressAnimation(callback) {
  clearInterval(progressInterval);
  const progressBar = document.getElementById("progressBar");
  const runner = document.getElementById("runner");
  const percentText = document.getElementById("progressPercent");

  progressBar.style.width = "100%";
  runner.style.left = "100%";
  percentText.textContent = "%100";

  setTimeout(() => {
    if (callback) callback();
  }, 600);
}

async function handlePDFUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("pdfStatus").textContent = `Yüklenen: ${file.name}`;
  document.getElementById("loadingBox").classList.remove("hidden");

  startProgressAnimation();

  try {
    const extractedText = await extractTextFromPDF(file);

    const response = await fetch('/api/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfText: extractedText })
    });

    const data = await response.json();

    if (data.questions && data.questions.length > 0) {
      completeProgressAnimation(() => {
        document.getElementById("loadingBox").classList.add("hidden");
        currentQuestions = data.questions;
        userAnswers = {};
        timeSpentPerQuestion = {};
        
        document.getElementById("uploadScreen").classList.add("hidden");
        document.getElementById("startConfirmScreen").classList.remove("hidden");
        document.getElementById("readyQuestionsCount").textContent = `Toplam ${currentQuestions.length} YDS sorusu başarıyla hazırlandı.`;
      });
    } else {
      clearInterval(progressInterval);
      document.getElementById("loadingBox").classList.add("hidden");
      alert("Hata: " + (data.error || "Soru çıkarılamadı."));
    }

  } catch (error) {
    console.error(error);
    clearInterval(progressInterval);
    document.getElementById("loadingBox").classList.add("hidden");
    alert("PDF işlenirken bir sunucu hatası oluştu.");
  }
}

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(" ") + "\n";
  }
  return fullText;
}

function startQuiz() {
  document.getElementById("startConfirmScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.remove("hidden");
  
  currentIndex = 0;
  secondsPassed = 0;
  startTimer();
  displayQuestion();
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    secondsPassed++;
    const mins = String(Math.floor(secondsPassed / 60)).padStart(2, '0');
    const secs = String(secondsPassed % 60).padStart(2, '0');
    document.getElementById("timerText").textContent = `${mins}:${secs}`;
  }, 1000);
}

function trackTimeForCurrentQuestion() {
  if (questionStartTime > 0) {
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    timeSpentPerQuestion[currentIndex] = (timeSpentPerQuestion[currentIndex] || 0) + elapsed;
  }
  questionStartTime = Date.now();
}

function displayQuestion() {
  trackTimeForCurrentQuestion();

  const q = currentQuestions[currentIndex];
  document.getElementById("questionCounter").textContent = `Soru: ${currentIndex + 1} / ${currentQuestions.length}`;
  document.getElementById("questionTypeTag").textContent = q.type || "YDS Genel";
  document.getElementById("questionText").textContent = `${currentIndex + 1}. ${q.question}`;

  // Paragraf veya Cloze Test Metni Kontrolü
  const passageBox = document.getElementById("passageBox");
  const passageTextElement = document.getElementById("passageText");

  if (q.passage && q.passage !== "null" && q.passage.trim().length > 10) {
    passageBox.classList.remove("hidden");
    passageTextElement.textContent = q.passage;
  } else {
    passageBox.classList.add("hidden");
    passageTextElement.textContent = "";
  }

  // Seçimi Temizle Butonunu Göster/Gizle
  const clearBtn = document.getElementById("clearAnswerBtn");
  if (userAnswers[currentIndex]) {
    clearBtn.classList.remove("hidden");
  } else {
    clearBtn.classList.add("hidden");
  }

  // Şıkların Hazırlanması
  const container = document.getElementById("optionsContainer");
  container.innerHTML = "";

  q.options.forEach((optText, i) => {
    const letter = String.fromCharCode(65 + i);
    const btn = document.createElement("button");
    btn.className = "option-btn";
    if (userAnswers[currentIndex] === letter) {
      btn.classList.add("selected");
    }
    btn.textContent = `${letter}) ${optText}`;
    btn.onclick = () => selectOption(letter);
    container.appendChild(btn);
  });

  document.getElementById("prevBtn").style.visibility = currentIndex === 0 ? "hidden" : "visible";
  if (currentIndex === currentQuestions.length - 1) {
    document.getElementById("nextBtn").classList.add("hidden");
    document.getElementById("finishBtn").classList.remove("hidden");
  } else {
    document.getElementById("nextBtn").classList.remove("hidden");
    document.getElementById("finishBtn").classList.add("hidden");
  }
}

function selectOption(letter) {
  // Eğer zaten seçili olan şıkka tekrar tıklanırsa seçimi kaldır (Boş bırak)
  if (userAnswers[currentIndex] === letter) {
    delete userAnswers[currentIndex];
  } else {
    userAnswers[currentIndex] = letter;
  }
  displayQuestion();
}

function clearAnswer() {
  if (userAnswers[currentIndex]) {
    delete userAnswers[currentIndex];
    displayQuestion();
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    displayQuestion();
  }
}

function nextQuestion() {
  if (currentIndex < currentQuestions.length - 1) {
    currentIndex++;
    displayQuestion();
  }
}

function finishQuiz() {
  trackTimeForCurrentQuestion();
  clearInterval(timerInterval);

  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.remove("hidden");

  let correctCount = 0;
  let emptyCount = 0;
  let wrongCount = 0;
  const typeStats = {}; 

  currentQuestions.forEach((q, idx) => {
    const type = q.type || "Genel Gramer";
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
      wrongCount++;
      typeStats[type].wrong++;
    }
  });

  const totalCount = currentQuestions.length;
  // YDS Puan Hesaplama
  const ydsScore = (correctCount * (100 / totalCount)).toFixed(1);
  
  document.getElementById("ydsScoreText").textContent = ydsScore;
  document.getElementById("scoreText").textContent = `${correctCount} / ${totalCount}`;
  document.getElementById("emptyText").textContent = emptyCount;
  
  const mins = String(Math.floor(secondsPassed / 60)).padStart(2, '0');
  const secs = String(secondsPassed % 60).padStart(2, '0');
  document.getElementById("totalTimeText").textContent = `${mins}:${secs}`;

  // Seviye Etiketi
  let level = "E / Baraj Altı";
  if (ydsScore >= 90) level = "A (90-100)";
  else if (ydsScore >= 80) level = "B (80-89)";
  else if (ydsScore >= 70) level = "C (70-79)";
  else if (ydsScore >= 60) level = "D (60-69)";
  else if (ydsScore >= 50) level = "E (50-59)";
  document.getElementById("ydsLevelTag").textContent = `YDS Seviyeniz: ${level}`;

  // Tablo Oluşturma
  const tableBody = document.getElementById("typeAnalysisBody");
  tableBody.innerHTML = "";

  let slowestType = "";
  let maxAvgTime = 0;

  for (const [type, stat] of Object.entries(typeStats)) {
    const avgSec = Math.round(stat.totalTime / stat.total);
    if (avgSec > maxAvgTime) {
      maxAvgTime = avgSec;
      slowestType = type;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${type}</strong></td>
      <td>${stat.total}</td>
      <td><span style="color:#16a34a">${stat.correct}D</span> / <span style="color:#dc2626">${stat.wrong}Y</span> / <span style="color:#64748b">${stat.empty}B</span></td>
      <td>${avgSec} sn / soru</td>
    `;
    tableBody.appendChild(tr);
  }

  // AI Tavsiye Metni
  document.getElementById("analysisAdviceText").innerHTML = `
    En çok zaman harcadığınız soru tipi: <strong>${slowestType || 'Soru Tipi'}</strong> (Soru başına ort. ${maxAvgTime} saniye). <br><br>
    Sınavda <strong>${emptyCount} adet soru boş bırakıldı</strong>. YDS'de yanlışlar doğruları götürmediği için emin olmasanız dahi tüm soruları işaretlemek puanınızı artırabilir.<br><br>
    ${ydsScore < 70 ? 'Özellikle yanlış yaptığınız soru gruplarının çözüm taktiklerini tekrar incelemeniz ve günlük okuma pratiği yapmanız önerilir.' : 'Tebrikler! Yüksek başarı oranına sahipsiniz, hızınızı ve soru taktiklerinizi koruyun.'}
  `;
}

function resetApp() {
  clearInterval(timerInterval);
  clearInterval(progressInterval);
  currentQuestions = [];
  currentIndex = 0;
  userAnswers = {};
  timeSpentPerQuestion = {};
  questionStartTime = 0;
  document.getElementById("uploadScreen").classList.remove("hidden");
  document.getElementById("startConfirmScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.add("hidden");
  document.getElementById("pdfFileInput").value = "";
  document.getElementById("pdfStatus").textContent = "Henüz dosya seçilmedi";
}
