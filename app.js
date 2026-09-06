pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentQuestions = [];
let currentIndex = 0;
let userAnswers = {}; // { 0: 'A', 1: 'C' }
let timerInterval = null;
let secondsPassed = 0;

async function handlePDFUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("pdfStatus").textContent = `Yüklenen: ${file.name}`;
  document.getElementById("loadingBox").classList.remove("hidden");

  try {
    const extractedText = await extractTextFromPDF(file);

    if (!extractedText.trim()) {
      alert("PDF dosyasından metin okunamadı.");
      document.getElementById("loadingBox").classList.add("hidden");
      return;
    }

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
      document.getElementById("uploadScreen").classList.add("hidden");
      document.getElementById("startConfirmScreen").classList.remove("hidden");
      document.getElementById("readyQuestionsCount").textContent = `Toplam ${currentQuestions.length} soru başarıyla hazırlandı.`;
    } else {
      alert("Hata: " + (data.error || "Soru çıkarılamadı."));
    }

  } catch (error) {
    console.error(error);
    document.getElementById("loadingBox").classList.add("hidden");
    alert("PDF işlenirken sunucu hatası oluştu.");
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

function displayQuestion() {
  const q = currentQuestions[currentIndex];
  document.getElementById("questionCounter").textContent = `Soru: ${currentIndex + 1} / ${currentQuestions.length}`;
  document.getElementById("questionTopic").textContent = q.topic || "Genel Sorular";
  document.getElementById("questionText").textContent = `${currentIndex + 1}. ${q.question}`;

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

  // Buton Yönetimi
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
  userAnswers[currentIndex] = letter;
  displayQuestion();
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
  clearInterval(timerInterval);
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.remove("hidden");

  let correctCount = 0;
  const topicStats = {};

  currentQuestions.forEach((q, idx) => {
    const topic = q.topic || "Genel Sorular";
    if (!topicStats[topic]) {
      topicStats[topic] = { total: 0, correct: 0, wrong: 0 };
    }
    topicStats[topic].total++;

    if (userAnswers[idx] === q.correct) {
      correctCount++;
      topicStats[topic].correct++;
    } else {
      topicStats[topic].wrong++;
    }
  });

  const totalCount = currentQuestions.length;
  const percentage = Math.round((correctCount / totalCount) * 100);

  const mins = String(Math.floor(secondsPassed / 60)).padStart(2, '0');
  const secs = String(secondsPassed % 60).padStart(2, '0');

  document.getElementById("scoreText").textContent = `${correctCount} / ${totalCount}`;
  document.getElementById("percentageText").textContent = `%${percentage}`;
  document.getElementById("totalTimeText").textContent = `${mins}:${secs}`;

  // Konu Analizi Listeleme
  const categoryContainer = document.getElementById("categoryAnalysisContainer");
  categoryContainer.innerHTML = "";
  
  let weakTopics = [];

  for (const [topic, stat] of Object.entries(topicStats)) {
    const item = document.createElement("div");
    item.className = "category-item";
    const statusClass = stat.wrong > 0 ? "bad-score" : "good-score";
    item.innerHTML = `
      <span><strong>${topic}</strong> (${stat.total} Soru)</span>
      <span class="${statusClass}">${stat.correct} Doğru / ${stat.wrong} Yanlış</span>
    `;
    categoryContainer.appendChild(item);

    if (stat.wrong > 0) {
      weakTopics.push(topic);
    }
  }

  // Tavsiye Metni Oluşturma
  const adviceText = document.getElementById("analysisAdviceText");
  if (weakTopics.length > 0) {
    adviceText.innerHTML = `Test sonuçlarınıza göre özellikle <strong>${weakTopics.join(", ")}</strong> konu gruplarında hatalar yaptınız. Bu konulara ait konu özetlerini tekrar gözden geçirmeniz ve bu başlıklarda bolca soru pratiği yapmanız önerilir.`;
  } else {
    adviceText.innerHTML = "Tebrikler! Tüm konularda mükemmel bir başarı gösterdiniz. Bilgilerinizi taze tutmak için düzenli aralıklarla genel denemeler çözmeye devam edebilirsiniz.";
  }
}

function resetApp() {
  clearInterval(timerInterval);
  currentQuestions = [];
  currentIndex = 0;
  userAnswers = {};
  document.getElementById("uploadScreen").classList.remove("hidden");
  document.getElementById("startConfirmScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.add("hidden");
  document.getElementById("pdfFileInput").value = "";
  document.getElementById("pdfStatus").textContent = "Henüz dosya seçilmedi";
}
