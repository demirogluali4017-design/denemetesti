export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Yalnızca POST kabul edilir.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY bulunamadı.' });

  try {
    const { wrongQuestions, language } = req.body;
    if (!wrongQuestions || wrongQuestions.length === 0) {
      return res.status(400).json({ error: 'Analiz edilecek yanlış soru bulunamadı.' });
    }

    const prompt = `
Aşağıda bir öğrencinin ${language} dilindeki YDS/YÖKDİL sınavında yanlış cevapladığı sorular verilmiştir.

TÜM YANLIŞ SORULAR İÇİN:
1. Öğrencinin işaretlediği şıkkın neden yanlış olduğunu ve doğru cevabın neden o şık olduğunu açıklayan Türkçe ve detaylı bir gerekçe yaz ("reason").
2. Bu soru tipine (${language} dilbilgisi/çeviri/okuma vb.) özel hızlı çözüm taktiği ver ("tactic").

Yanlış Sorular Listesi:
${JSON.stringify(wrongQuestions, null, 2)}
    `;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                qNumber: { type: "INTEGER" },
                type: { type: "STRING" },
                question: { type: "STRING" },
                userAnswer: { type: "STRING" },
                correctAnswer: { type: "STRING" },
                reason: { type: "STRING" },
                tactic: { type: "STRING" }
              },
              required: ["qNumber", "type", "question", "userAnswer", "correctAnswer", "reason", "tactic"]
            }
          }
        }
      })
    });

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const analysis = JSON.parse(rawText);

    return res.status(200).json({ analysis });

  } catch (error) {
    console.error("Yanlış Soru Analiz Hatası:", error);
    return res.status(500).json({ error: 'Analiz üretilirken hata oluştu.' });
  }
}
