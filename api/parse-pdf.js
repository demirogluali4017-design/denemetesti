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
    if (!pdfText || pdfText.trim().length === 0) {
      return res.status(400).json({ error: 'PDF içeriği boş veya okunamadı.' });
    }

    const prompt = `
Aşağıdaki metin bir YDS / YÖKDİL dil sınavı belgesidir. 
TÜM soruları eksiksiz analiz et.

ÖNEMLİ - DİL VE KATEGORİ TESPİTİ:
1. Metnin ana yabancı dilini tespit et (örn: "Fransızca", "İngilizce", "Almanca").
2. "type" kategorisi alanına ASLA "Multiple Choice" veya "İngilizce - Türkçe Çeviri" (eğer sınav Fransızca ise) yazma!
3. Tespit ettiğin dile göre doğru çeviri kategorisi ver. (Örn: Fransızca ise "Fransızca - Türkçe Çeviri" veya "Türkçe - Fransızca Çeviri").

KULLANILACAK KATEGORİLER:
- "Kelime Bilgisi"
- "Gramer / Dilbilgisi"
- "Cloze Test"
- "Cümle Tamamlama"
- "[Tespit Edilen Dil] - Türkçe Çeviri"
- "Türkçe - [Tespit Edilen Dil] Çeviri"
- "Paragraf / Okuma Anlama"
- "Diyalog Tamamlama"
- "Eş Anlamlı Cümle (Restatement)"
- "Paragraf Tamamlama"
- "Anlam Bütünlüğünü Bozan Cümle"

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
          response_mime_type: "application/json",
          response_schema: {
            type: "OBJECT",
            properties: {
              detectedLanguage: { type: "STRING" },
              questions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    instruction: { type: "STRING" },
                    type: { type: "STRING" },
                    passage: { type: "STRING", nullable: true },
                    question: { type: "STRING" },
                    options: {
                      type: "ARRAY",
                      items: { type: "STRING" }
                    },
                    correct: { type: "STRING" }
                  },
                  required: ["type", "question", "options", "correct"]
                }
              }
            },
            required: ["detectedLanguage", "questions"]
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API hatası.' });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsedData = JSON.parse(rawText);

    return res.status(200).json({
      detectedLanguage: parsedData.detectedLanguage || "Fransızca",
      questions: parsedData.questions || []
    });

  } catch (error) {
    console.error("API Hatası:", error);
    return res.status(500).json({ error: 'Soru analizi sırasında sunucu hatası oluştu.' });
  }
}
