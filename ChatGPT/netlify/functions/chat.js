exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ answer: "仅支持 POST" }) };
    }

    const { question } = JSON.parse(event.body || "{}");
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ answer: "API Key 未配置" }) };
    }

    // 设置一个控制器，如果请求太久没反应就主动断开
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9500); // 9.5秒自断，留点时间给系统返回

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are an expert in the history of English. Please give a brief and concise answer (under 150 words)."
          },
          { role: "user", content: question }
        ],
        max_tokens: 500, // 限制生成长度，加快响应速度
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ answer: "DeepSeek API 响应异常，请稍后再试。" })
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        answer: data.choices?.[0]?.message?.content || "AI 未能生成有效回复。"
      })
    };

  } catch (err) {
    console.error("Error:", err.name);
    if (err.name === 'AbortError') {
      return {
        statusCode: 504,
        body: JSON.stringify({ answer: "抱歉，DeepSeek 响应太慢，已超过 Netlify 的 10 秒限制。请稍后重试或尝试更简短的问题。" })
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ answer: "服务器内部错误", error: err.message })
    };
  }
};