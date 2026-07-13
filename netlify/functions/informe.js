// Función para consultar los avisos guardados — usada para generar el informe diario.
// Protegida con un token secreto: solo responde si se le pasa el token correcto.
//
// Variable de entorno necesaria:
//   INFORME_TOKEN  -> contraseña secreta para poder consultar el listado
//
// Uso: GET /.netlify/functions/informe?token=TU_TOKEN

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;

  if (!process.env.INFORME_TOKEN || token !== process.env.INFORME_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  try {
    const store = getStore('avisos');
    const { blobs } = await store.list();

    const registros = [];
    for (const b of blobs) {
      const data = await store.get(b.key, { type: 'json' });
      if (data) registros.push(data);
    }

    registros.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: registros.length, avisos: registros })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
