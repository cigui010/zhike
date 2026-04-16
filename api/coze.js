// api/coze.js
export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let cozeUrl = 'https://api.coze.cn/v3/chat';
    
    // 根据请求路径判断调用哪个 Coze API
    if (req.url.includes('/retrieve')) {
      cozeUrl = `https://api.coze.cn/v3/chat/retrieve${req.url.split('/retrieve')[1]}`;
    } else if (req.url.includes('/message/list')) {
      cozeUrl = `https://api.coze.cn/v3/chat/message/list${req.url.split('/message/list')[1]}`;
    }

    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${process.env.COZE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    if (req.method === 'POST') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(cozeUrl, fetchOptions);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}