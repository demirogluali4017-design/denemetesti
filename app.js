pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentQuestions = [];
let currentIndex = 0;
let userAnswers = [];

async function handlePDFUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("pdfStatus").textContent = `Yüklenen: ${file.name}`;
  document.getElementById("loadingBox").classList.remove("hidden");

  try {
    const extractedText = await extractTextFromPDF(file);

    if (!extractedText.trim()) {
      alert("PDF dosyasından metin okunamadı. Lütfen metin içeren bir PDF deneyin.");
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
      currentIndex = 0;
      userAnswers = [];
      showQuiz();
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

function showQuiz() {
  document.getElementById("uploadScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.remove("hidden");
  displayQuestion();
}

function displayQuestion() {
  const q = currentQuestions[currentIndex];
  document.getElementById("questionCounter").textContent = `Soru: ${currentIndex + 1} / ${currentQuestions.length}`;
  document.getElementById("questionText").textContent = `${currentIndex + 1}. ${q.question}`;

  const container = document.getElementById("optionsContainer");
  container.innerHTML = "";
  document.getElementById("feedbackBox").classList.add("hidden");
  document.getElementById("nextBtn").classList.add("hidden");

  q.options.forEach((optText, i) => {
    const letter = String.fromCharCode(65 + i);
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = `${letter}) ${optText}`;
    btn.onclick = () => selectOption(letter, q.correct, btn);
    container.appendChild(btn);
  });
}

function selectOption(selectedLetter, correctLetter, btnElement) {
  const buttons = document.querySelectorAll(".option-btn");
  buttons.forEach(b => b.disabled = true);

  const isCorrect = selectedLetter === correctLetter;
  userAnswers.push({
    question: currentQuestions[currentIndex].question,
    selected: selectedLetter,
    correct: correctLetter,
    isCorrect: isCorrect
  });

  const feedback = document.getElementById("feedbackBox");
  feedback.classList.remove("hidden");

  if (isCorrect) {
    btnElement.classList.add("correct");
    feedback.className = "feedback correct";
    feedback.textContent = "Tebrikler! Doğru cevap.";
  } else {
    btnElement.classList.add("wrong");
    feedback.className = "feedback wrong";
    feedback.textContent = `Yanlış cevap. Doğru Seçenek: ${correctLetter}`;
  }

  document.getElementById("nextBtn").classList.remove("hidden");
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex < currentQuestions.length) {
    displayQuestion();
  } else {
    showResults();
  }
}

function showResults() {
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.remove("hidden");

  const correctCount = userAnswers.filter(a => a.isCorrect).length;
  const totalCount = userAnswers.length;
  const percentage = Math.round((correctCount / totalCount) * 100);

  document.getElementById("scoreText").textContent = `${correctCount} / ${totalCount}`;
  document.getElementById("percentageText").textContent = `%${percentage}`;

  // AI Analiz Özeti Üret
  let analysis = "";
  if (percentage >= 80) {
    analysis = "Harika bir performans! Konu kavramanız çok yüksek. Soruları çözerken gösterdiğiniz dikkat üst seviyede.";
  } else if (percentage >= 50) {
    analysis = "Orta düzey performans. Yanlış yaptığınız soru tiplerine odaklanarak eksiklerinizi tamamlayabilirsiniz.";
  } else {
    analysis = "Konu eksiklikleri tespit edildi. Metindeki temel kavramları tekrar gözden geçirmeniz ve daha fazla soru çözmeniz önerilir.";
  }

  document.getElementById("analysisText").textContent = analysis;
}

function resetApp() {
  currentQuestions = [];
  currentIndex = 0;
  userAnswers = [];
  document.getElementById("uploadScreen").classList.remove("hidden");
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.add("hidden");
  document.getElementById("pdfFileInput").value = "";
  document.getElementById("pdfStatus").textContent = "Henüz dosya seçilmedi";
}