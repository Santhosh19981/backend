const jwt = require('jsonwebtoken');

try {
  const token = jwt.sign({ id: 1 }, 'secret', { expiresIn: undefined });
  console.log('Token with undefined expiresIn:', token);
} catch (err) {
  console.error('Error with undefined expiresIn:', err.message);
}

try {
  const token = jwt.sign({ id: 1 }, 'secret', { expiresIn: '7d' });
  console.log('Token with 7d expiresIn:', token);
} catch (err) {
  console.error('Error with 7d expiresIn:', err.message);
}
