// src/App.js
import React from 'react';
import MonologedAI from './MonologedAI'; // Plain CSS kullanan sohbet arayüzü bileşenimiz
import './App.css'; // App.js'e özel genel stilleriniz için (opsiyonel)
// import './index.css'; // Eğer genel stilleriniz index.css'te ise ve burada da kullanmak istiyorsanız

function App() {
  return (
    // Bu div sarmalayıcısı, App bileşenine özel genel bir konteyner görevi görebilir.
    // MonologedAI bileşeni kendi ana sarmalayıcısına (.monologed-ai-container) sahip.
    <div className="App">
      <MonologedAI />
    </div>
  );
}

export default App;
