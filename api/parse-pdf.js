export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Yalnızca POST kabul edilir.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY bulunamadı.' });

  try {
    const { pdfText } = req.body;

    const prompt = `
Aşağıdaki metin bir YDS sınav belgesidir. Metindeki TÜM soruları analiz et ve SADECE saf bir JSON dizisi formatında döndür.

JSON Şablonu:
[
  {
    "type": "Soru Tipi (Örn: Paragraf, Cloze Test, Kelime Bilgisi, Cümle Tamamlama, Çeviri, Paragraf Tamamlama, Anlam Bütünlüğü)",
    "passage": "Eğer soru bir Paragrafa veya Cloze Test metnine bağlıysa, O METNİN TAMAMINI BURAYA EKLE. Bağımsız bir soru ise null yap.",
    "question": "Soru metni (Cloze test ise boşluk içeren cümle veya soru numarası)",
    "options": ["A şıkkı", "B şıkkı", "C şıkkı", "D şıkkı", "E şıkkı"],
    "correct": "A"
  }
]

ÇOK ÖNEMLİ KRİTİK KURALLAR:
1. PARAGRAF VE CLOZE TEST GRUPLARI: Örneğin bir paragraftan 4 soru çıkarılmışsa veya 1 Cloze Test metninden 5 soru çıkarılmışsa, O 4 VEYA 5 SORUNUN HER BİRİNİN "passage" ALANINA AYNI METNİ EKSİKSİZ BİÇİMDE TEKRAR YAZIN. Hiçbirini boş bırakmayın.
2. Cloze test sorularında okuma parçasını mutlaka "passage" içine koyun.
3. Yanıtına Markdown kaplaması (\`\`\`json) ekleme, sadece saf JSON döndür.

Metin:
${pdfText}
    `;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    const questions = JSON.parse(rawText);
    return res.status(200).json({ questions });

  } catch (error) {
    console.error("API Hatası:", error);
    return res.status(500).json({ error: 'Soru analizi sırasında hata oluştu.' });
  }
}
