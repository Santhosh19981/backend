const app = require('./src/app');
require('dotenv').config();

const PORT = process.env.PORT || 5010;

app.listen(PORT, () => {
    console.log(`
    🚀 CarMate Backend Running!
    ---------------------------
    Url: http://localhost:${PORT}
    Env: ${process.env.NODE_ENV || 'development'}
    ---------------------------
    `);
});
