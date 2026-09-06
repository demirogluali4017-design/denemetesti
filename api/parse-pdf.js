export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Yalnızca POST kabul edilir.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY Vercel üzerinde tanımlanmamış.' });
  }

  try {
    const { pdfText } = req.body;
    if (!pdfText || pdfText.trim().length === 0) {
      return res.status(400).json({ error: 'PDF içeriği boş veya okunamadı.' });
    }

    const prompt = `
Aşağıdaki metindeki çoktan seçmeli soruları analiz et ve SADECE saf bir JSON dizisi (array) formatında döndür.

JSON Formatı Örneği:
[
  {
    "question": "Soru metni buraya",
    "options": ["A şıkkı metni", "B şıkkı metni", "C şıkkı metni", "D şıkkı metni"],
    "correct": "A"
  }
]

Önemli Kurallar:
- Yanıtına HİÇBİR açıklama veya markdown kesmesi (\`\`\`json gibi) EKLEME. Sadece ham JSON string döndür.
- "correct" değeri A, B, C veya D harflerinden biri olmalıdır.

Analiz Edilecek Metin:
${pdfText.substring(0, 8000)}
    `;

    // Güncel Model Adı: gemini-3.6-flash
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API hatası.' });
    }

    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const questions = JSON.parse(rawText);
    return res.status(200).json({ questions });

  } catch (error) {
    console.error("Sunucu Hatası:", error);
    return res.status(500).json({ error: 'Soru ayrıştırma sırasında sunucu hatası oluştu.' });
  }
}
