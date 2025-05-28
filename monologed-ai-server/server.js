// Gerekli modülleri import ediyoruz
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import AWS from 'aws-sdk'; // AWS SDK'sını import ediyoruz
import { v4 as uuidv4 } from 'uuid'; // Benzersiz ID'ler oluşturmak için uuid
import fetch from 'node-fetch'; // Gemini API'ye istek yapmak için

// Ortam değişkenlerini .env dosyasından yüklemek için dotenv'i yapılandırıyoruz
dotenv.config();

// Express uygulamasını başlatıyoruz
const app = express();

// CORS (Cross-Origin Resource Sharing) middleware'ini aktif ediyoruz
app.use(cors());

// JSON request body'lerini parse etmek için middleware
app.use(express.json());

// AWS SDK'sını yapılandırıyoruz
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'MonologedAIChats';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Gemini API Anahtarını .env'den alıyoruz
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;


// Basit bir test rotası
app.get('/', (req, res) => {
  res.status(200).send('Monologed AI Backend Sunucusu Çalışıyor! Gemini API Entegrasyonu Yapılıyor.');
});

// Mesajı DynamoDB'ye kaydetmek için yardımcı fonksiyon
const saveMessageToDb = async (sessionId, sender, text) => {
  const messageId = uuidv4();
  const timestamp = new Date().toISOString();
  const params = {
    TableName: DYNAMODB_TABLE_NAME,
    Item: {
      sessionId: sessionId,
      messageId: `${timestamp}_${messageId}`,
      sender: sender,
      text: text,
      createdAt: timestamp,
    },
  };
  try {
    await dynamoDb.put(params).promise();
    console.log(`${sender} mesajı DynamoDB'ye kaydedildi:`, params.Item.text.substring(0, 50) + "..."); // Mesajın tamamını loglamamak için kısaltıldı
    return params.Item;
  } catch (error) {
    console.error('DynamoDB\'ye mesaj kaydedilirken hata:', error);
    throw error;
  }
};

// Gemini API'den yanıt almak için yardımcı fonksiyon
const getGeminiResponse = async (userMessage, chatHistory = []) => {
  if (!GEMINI_API_KEY) {
    console.error('Gemini API Anahtarı bulunamadı. Lütfen .env dosyasını kontrol edin.');
    return 'Üzgünüm, API anahtarım yapılandırılmamış. Lütfen daha sonra tekrar deneyin.';
  }

  // Konuşma geçmişini Gemini formatına uygun hale getir
  const contents = [
    ...chatHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    })),
    {
      role: 'user',
      parts: [{ text: `Film ve dizilerle ilgili bir sohbet botusun. Kullanıcının sorusu: "${userMessage}". Lütfen sadece film veya diziyle ilgiliyse ve uygun bir dille cevap ver.` }],
    }
  ];

  try {
    console.log("Gemini API'ye gönderilen içerik:", JSON.stringify(contents, null, 2));
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API Hatası:', response.status, errorData);
      throw new Error(`Gemini API isteği başarısız oldu: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 &&
        data.candidates[0].content && data.candidates[0].content.parts &&
        data.candidates[0].content.parts.length > 0) {
      console.log("Gemini API'den gelen ham yanıt:", JSON.stringify(data, null, 2));
      return data.candidates[0].content.parts[0].text;
    } else if (data.promptFeedback && data.promptFeedback.blockReason) {
        console.warn('Gemini API tarafından engellendi:', data.promptFeedback.blockReason);
        return `İsteğiniz içerik politikaları nedeniyle engellendi: ${data.promptFeedback.blockReason}. Lütfen farklı bir soru sorun.`;
    } 
    else {
      console.warn('Gemini API\'den beklenen formatta yanıt alınamadı:', data);
      return 'Gemini\'den anlamlı bir yanıt alamadım, üzgünüm.';
    }
  } catch (error) {
    console.error('Gemini API çağrısında hata:', error);
    return 'Film bilgisi alınırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
  }
};

// Belirli bir oturum ID'sine ait son N mesajı getiren fonksiyon
const getChatHistory = async (sessionId, limit = 10) => {
  const params = {
    TableName: DYNAMODB_TABLE_NAME,
    KeyConditionExpression: 'sessionId = :sid',
    ExpressionAttributeValues: {
      ':sid': sessionId,
    },
    ScanIndexForward: false, // En son mesajları almak için false (azalan sıralama)
    Limit: limit,
  };

  try {
    const result = await dynamoDb.query(params).promise();
    // Gemini'nin beklediği sıraya (en eski önce) geri çevir
    return result.Items.reverse(); 
  } catch (error) {
    console.error(`Oturum ${sessionId} için konuşma geçmişi alınırken hata:`, error);
    return []; // Hata durumunda boş geçmiş dön
  }
};


// Sohbet mesajlarını işlemek için /api/chat endpoint'i
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId: existingSessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mesaj içeriği boş olamaz.' });
    }

    const sessionId = existingSessionId || uuidv4();
    console.log(`Frontend'den gelen mesaj (Oturum: ${sessionId}):`, message);
    await saveMessageToDb(sessionId, 'user', message);

    // Gemini'ye göndermeden önce konuşma geçmişini al
    const history = await getChatHistory(sessionId, 6); // Son 6 mesajı al (3 soru-cevap çifti)

    // Gemini API'den yanıt al
    const botResponseText = await getGeminiResponse(message, history);
    
    await saveMessageToDb(sessionId, 'bot', botResponseText);

    res.status(200).json({ reply: botResponseText, sessionId: sessionId });

  } catch (error) {
    console.error('Sohbet endpoint\'inde hata:', error);
    res.status(500).json({ error: 'Sunucuda bir hata oluştu.' });
  }
});

// Belirli bir oturum ID'sine ait tüm mesajları getiren endpoint
app.get('/api/chat/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'Oturum ID\'si gerekli.' });
    }
    // DynamoDB'den mesajları alırken en eski mesajların önce gelmesi için ScanIndexForward: true
    const items = await getChatHistory(sessionId, 50); // Son 50 mesajı al, en eskisi önce
    res.status(200).json(items);

  } catch (error) {
    console.error(`Oturum ${req.params.sessionId} mesajları alınırken hata:`, error);
    res.status(500).json({ error: 'Mesajlar alınırken sunucuda bir hata oluştu.' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Monologed AI backend sunucusu http://localhost:${PORT} adresinde çalışıyor.`);
  console.log(`DynamoDB Tablo Adı: ${DYNAMODB_TABLE_NAME}`);
  if (!GEMINI_API_KEY) {
    console.warn('UYARI: GEMINI_API_KEY .env dosyasında tanımlanmamış. Gemini API çağrıları çalışmayacaktır.');
  } else {
    console.log('Gemini API Anahtarı yüklendi.');
  }
});
