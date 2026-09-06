pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentQuestions = [];
let currentIndex = 0;
let userAnswers = {}; 
let timeSpentPerQuestion = {}; 
let questionStartTime = 0;

let timerInterval = null;
let secondsPassed = 0;

async function handlePDFUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("pdfStatus").textContent = `Yüklenen: ${file.name}`;
  document.getElementById("loadingBox").classList.remove("hidden");

  try {
    const extractedText = await extractTextFromPDF(file);

    const response = await fetch('/api/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfText: extractedText })
    });

    const data = await response.json();
    document.getElementById("loadingBox").classList.add("hidden");

    if (data.questions && data.questions.length > 0) {
      currentQuestions = data.questions;
      userAnswers = {};
      timeSpentPerQuestion = {};
      
      document.getElementById("uploadScreen").classList.add("hidden");
      document.getElementById("startConfirmScreen").classList.remove("hidden");
      document.getElementById("readyQuestionsCount").textContent = `Toplam ${currentQuestions.length} YDS sorusu başarıyla hazırlandı.`;
    } else {
      alert("Hata: " + (data.error || "Soru çıkarılamadı."));
    }

  } catch (error) {
    console.error(error);
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
  questionStartTime = Date.now();
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

function renderQuestionNav() {
  const navGrid = document.getElementById("questionNavGrid");
  navGrid.innerHTML = "";

  currentQuestions.forEach((_, idx) => {
    const btn = document.createElement("button");
    btn.className = "nav-btn";
    
    if (idx === currentIndex) {
      btn.classList.add("active");
    }
    if (userAnswers[idx]) {
      btn.classList.add("answered");
    }

    btn.textContent = idx + 1;
    btn.onclick = () => jumpToQuestion(idx);
    navGrid.appendChild(btn);
  });
}

function jumpToQuestion(index) {
  if (index >= 0 && index < currentQuestions.length) {
    trackTimeForCurrentQuestion();
    currentIndex = index;
    displayQuestion();
  }
}

function displayQuestion() {
  const q = currentQuestions[currentIndex];
  document.getElementById("questionCounter").textContent = `Soru: ${currentIndex + 1} / ${currentQuestions.length}`;
  document.getElementById("questionTypeTag").textContent = q.type || "YDS Genel";
  document.getElementById("questionText").textContent = `${currentIndex + 1}. ${q.question}`;

  // Yönerge / PDF Talimat Metni Kontrolü
  const instructionBox = document.getElementById("instructionBox");
  const instructionText = document.getElementById("instructionText");
  if (q.instruction && q.instruction.trim().length > 3) {
    instructionBox.classList.remove("hidden");
    instructionText.textContent = q.instruction;
  } else {
    instructionBox.classList.add("hidden");
  }

  // Seçimi Temizle Butonu Mantığı
  const clearBtn = document.getElementById("clearAnswerBtn");
  if (userAnswers[currentIndex]) {
    clearBtn.classList.remove("hidden");
  } else {
    clearBtn.classList.add("hidden");
  }

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

  // Navigasyon Gridini Güncelle
  renderQuestionNav();
}

function selectOption(letter) {
  userAnswers[currentIndex] = letter;
  displayQuestion();
}

function clearAnswer() {
  delete userAnswers[currentIndex];
  displayQuestion();
}

function prevQuestion() {
  if (currentIndex > 0) {
    trackTimeForCurrentQuestion();
    currentIndex--;
    displayQuestion();
  }
}

function nextQuestion() {
  if (currentIndex < currentQuestions.length - 1) {
    trackTimeForCurrentQuestion();
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
      <td>${stat.correct} D / ${stat.wrong} Y / ${stat.empty} B</td>
      <td>${avgSec} sn / soru</td>
    `;
    tableBody.appendChild(tr);
  }

  document.getElementById("analysisAdviceText").innerHTML = `
    En çok zaman harcadığınız soru tipi: <strong>${slowestType || 'Soru Tipi'}</strong> (Soru başına ort. ${maxAvgTime} saniye). <br><br>
    YDS'de zaman yönetimi kritik önem taşır. Soru başına ortalama 1.5 - 2 dakikayı aşmamaya özen göstermelisiniz. ${ydsScore < 70 ? 'Özellikle yanlış yaptığınız soru gruplarının çözüm taktiklerini tekrar incelemeniz ve günlük okuma pratiği yapmanız önerilir.' : 'Tebrikler! Yüksek başarı oranına sahipsiniz, hızınızı ve soru taktiklerinizi koruyun.'}
  `;
}

function resetApp() {
  clearInterval(timerInterval);
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
