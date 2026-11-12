'use strict';
const { createApp } = require('./app');
const { seedDemo } = require('./seed');

const port = Number(process.env.PORT) || 3000;
const dbFile = process.env.SPLITIT_DB || './data/splitit.db';
require('fs').mkdirSync(require('path').dirname(dbFile), { recursive: true });

const { app, db, registerUser } = createApp({ dbFile });
if (process.env.SPLITIT_SEED !== '0') seedDemo(db, registerUser);

app.listen(port, () => {
  console.log('Split It running at http://localhost:' + port);
  if (!process.env.SPLITIT_JWT_SECRET) console.log('Tip: set SPLITIT_JWT_SECRET (32+ characters) so logins survive restarts.');
});
