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
TÜM soruları analiz et ve SADECE saf bir JSON dizisi formatında döndür.

JSON Şablonu:
[
  {
    "type": "Soru Tipi (Örn: Paragraf, Cloze Test, Kelime Bilgisi, Cümle Tamamlama, Çeviri, Paragraf Tamamlama, Anlam Bütünlüğü)",
    "passage": "Eğer soru bir Paragrafa veya Cloze Test metnine bağlıysa, O METNİN TAMAMINI BURAYA EKLE. Bağımsız bir soru ise null yap.",
    "question": "Soru metni veya numarası",
    "options": ["A şıkkı metni", "B şıkkı metni", "C şıkkı metni", "D şıkkı metni", "E şıkkı metni"],
    "correct": "A"
  }
]

ÇOK ÖNEMLİ KRİTİK KURALLAR:
1. PARAGRAF VE CLOZE TEST GRUPLARI: Örneğin bir paragraftan 4 soru çıkarılmışsa veya 1 Cloze Test metninden 5 soru çıkarılmışsa, O SORULARIN HER BİRİNİN "passage" ALANINA AYNI METNİ EKSİKSİZ BİÇİMDE TEKRAR YAZIN. Hiçbirini boş bırakmayın.
2. "correct" alanına doğru cevabın harfini yazın (A, B, C, D veya E).
3. Yanıtına Markdown kaplaması (\`\`\`json) ekleme, sadece saf JSON döndür.

Metin:
${pdfText}
    `;

    // Güncel Gemini 3.6 Flash API İsteği
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

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API hatası.' });
    }

    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const questions = JSON.parse(rawText);
    return res.status(200).json({ questions });

  } catch (error) {
    console.error("API Hatası:", error);
    return res.status(500).json({ error: 'Soru analizi sırasında sunucu hatası oluştu.' });
  }
}
