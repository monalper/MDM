# Monologed AI

Bu monorepo, **monologed-ai-client** ve **monologed-ai-server** olmak üzere iki proje içerir.

## Backend (monologed-ai-server)

Backend sunucusu, Express.js ve AWS DynamoDB kullanarak sohbet geçmişini saklar ve Google Gemini API ile yanıt üretir.

Geliştirme ortamında, `monologed-ai-server` klasöründe bir `.env` dosyası oluşturun ve aşağıdaki değişkenleri tanımlayın (sizin değerlerinizle değiştirin):

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
DYNAMODB_TABLE_NAME=MonologedAIChats
GEMINI_API_KEY=your-gemini-api-key
PORT=5001
```

Vercel gibi bir platforma dağıtırken, bu değerleri proje ayarları → Environment Variables bölümüne tek tek ekleyin.

## Frontend (monologed-ai-client)

React uygulaması, `REACT_APP_BACKEND_URL` değişkeni ile backend API adresine bağlanır.

Geliştirme ortamında, bir `.env` dosyası oluşturabilirsiniz:

```
REACT_APP_BACKEND_URL=http://localhost:5001
```

Vercel üzerine dağıtırken, `REACT_APP_BACKEND_URL` değerini (örneğin `https://your-backend-url.vercel.app`) Environment Variables bölümüne girmeniz yeterlidir.

---

Tüm projenin kökünde çalıştırmak için:

```bash
# Client
cd monologed-ai-client && npm install && npm start

# Server
cd monologed-ai-server && npm install && npm start
``` 