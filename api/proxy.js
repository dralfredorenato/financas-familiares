export default async function handler(req, res) {export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Organizze-Email, X-Organizze-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const endpoint = req.query.endpoint;
  const email = req.headers['x-organizze-email'];
  const token = req.headers['x-organizze-token'];

  if (!email || !token) {
    return res.status(401).json({ error: 'Email e token obrigatorios' });
  }

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint obrigatorio' });
  }

  const url = 'https://api.organizze.com.br/rest/v2/' + endpoint;
  const auth = Buffer.from(email + ':' + token).toString('base64');

  const params = new URLSearchParams();
  Object.entries(req.query).forEach(function(entry) {
    if (entry[0] !== 'endpoint') params.append(entry[0], entry[1]);
  });
  const qs = params.toString();
  const fullUrl = qs ? url + '?' + qs : url;

  try {
    const fetchOptions = {export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Organizze-Email, X-Organizze-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const endpoint = req.query.endpoint;
  const email = req.headers['x-organizze-email'];
  const token = req.headers['x-organizze-token'];

  if (!email || !token) {
    return res.status(401).json({ error: 'Email e token obrigatorios' });
  }

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint obrigatorio' });
  }

  const url = 'https://api.organizze.com.br/rest/v2/' + endpoint;
  const auth = Buffer.from(email + ':' + token).toString('base64');

  const params = new URLSearchParams();
  Object.entries(req.query).forEach(function(entry) {
    if (entry[0] !== 'endpoint') params.append(entry[0], entry[1]);
  });
  const qs = params.toString();
  const fullUrl = qs ? url + '?' + qs : url;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        'User-Agent': 'Familia Metzger App (dralfredorenato@gmail.com)'
      }
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(fullUrl, fetchOptions);
    const data = await response.text();

    res.status(response.status);

    try {
      return res.json(JSON.parse(data));
    } catch (e) {
      return res.send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Erro no proxy', details: error.message });
  }
}
      method: req.method,
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        'User-Agent': 'Familia Metzger App (dralfredorenato@gmail.com)'
      }
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(fullUrl, fetchOptions);
    const data = await response.text();

    res.status(response.status);

    try {
      return res.json(JSON.parse(data));
    } catch (e) {
      return res.send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Erro no proxy', details: error.message });
  }
}
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Email, X-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const email = req.headers['x-email'];
  const token = req.headers['x-token'];
  const endpoint = req.query.endpoint || req.headers['x-endpoint'];

  if (!email || !token || !endpoint) {
    return res.status(400).json({ error: 'Missing email, token, or endpoint' });
  }

  const url = `https://api.organizze.com.br/rest/v2${endpoint}`;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  const params = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key !== 'endpoint') params.append(key, value);
  });
  const queryString = params.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Familia Metzger App (dralfredorenato@gmail.com)'
      }
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(fullUrl, fetchOptions);
    const data = await response.text();

    res.status(response.status);

    try {
      return res.json(JSON.parse(data));
    } catch {
      return res.send(data);
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
