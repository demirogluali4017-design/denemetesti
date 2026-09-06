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
Aşağıdaki metin bir YDS (Yabancı Dil Bilgisi Seviye Tespit Sınavı) belgesidir. 
TÜM soruları eksiksiz analiz et.

ÇOK ÖNEMLİ - "type" KATEGORİZASYON KURALI:
"type" alanına ASLA "Multiple Choice", "Test", "Soru" gibi genel kelimeler yazma! 
Sadece ve sadece aşağıdaki resmi YDS soru tiplerinden birini seçerek yaz:
- "Kelime Bilgisi" (Vocabulary / Phrasal Verbs)
- "Gramer / Dilbilgisi" (Tense, Preposition, Conjunction vb.)
- "Cloze Test"
- "Cümle Tamamlama"
- "İngilizce - Türkçe Çeviri"
- "Türkçe - İngilizce Çeviri"
- "Paragraf / Okuma Anlama" (Reading Comprehension)
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
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API hatası.' });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const questions = JSON.parse(rawText);

    return res.status(200).json({ questions });

  } catch (error) {
    console.error("API Hatası:", error);
    return res.status(500).json({ error: 'Soru analizi sırasında sunucu hatası oluştu.' });
  }
}
